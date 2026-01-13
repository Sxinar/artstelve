import { json } from '@sveltejs/kit';
import * as cheerio from 'cheerio';
import { createHash } from 'crypto';
import type { RequestHandler } from './$types';
import { ProxyAgent } from 'undici';

type SearchEngine =
	| 'google'
	| 'bing'
	| 'duckduckgo'
	| 'ecosia'
	| 'startpage'
	| 'qwant'
	| 'yahoo'
	| 'yandex'
	| 'mojeek';

type SearchResult = {
	title: string;
	url: string;
	description: string;
};

function clampCount(value: string | null): number {
	const n = Number.parseInt(value ?? '20', 10);
	if (Number.isNaN(n)) return 20;
	return Math.max(1, Math.min(n, 50));
}

function getAllowedProxyUrl(customProxyUrl: string | null): string | undefined {
	const allowCustom = String(process.env.ALLOW_CUSTOM_PROXY || '').toLowerCase() === 'true';
	const envProxy = process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
	if (allowCustom && customProxyUrl) {
		try {
			const u = new URL(customProxyUrl);
			if (u.protocol === 'http:' || u.protocol === 'https:') return u.toString();
		} catch {
			// ignore
		}
	}
	return envProxy || undefined;
}

const USER_AGENTS = [
	'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
	'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_2_1) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15',
	'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
	'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:122.0) Gecko/20100101 Firefox/122.0'
];

function pickUserAgent(): string {
	return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)] ?? USER_AGENTS[0];
}

function getClientIp(request: Request): string {
	const xff = request.headers.get('x-forwarded-for');
	if (xff) {
		const first = xff.split(',')[0]?.trim();
		if (first) return first;
	}
	const realIp = request.headers.get('x-real-ip');
	if (realIp) return realIp;
	return 'unknown';
}

function hashIp(ip: string): string {
	return createHash('sha256').update(ip).digest('hex');
}

type RateLimitBucket = {
	resetAtMs: number;
	count: number;
};

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 30;
const rateLimitBuckets = new Map<string, RateLimitBucket>();

function checkRateLimit(key: string): { ok: true } | { ok: false; retryAfterSeconds: number } {
	const now = Date.now();
	const existing = rateLimitBuckets.get(key);
	if (!existing || existing.resetAtMs <= now) {
		rateLimitBuckets.set(key, { resetAtMs: now + RATE_LIMIT_WINDOW_MS, count: 1 });
		return { ok: true };
	}

	if (existing.count >= RATE_LIMIT_MAX) {
		return { ok: false, retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAtMs - now) / 1000)) };
	}

	existing.count += 1;
	return { ok: true };
}

function normalizeEngine(engine: string | null): SearchEngine {
	const e = (engine ?? 'duckduckgo').toLowerCase();
	if (
		e === 'google' ||
		e === 'bing' ||
		e === 'duckduckgo' ||
		e === 'ecosia' ||
		e === 'startpage' ||
		e === 'qwant' ||
		e === 'yahoo' ||
		e === 'yandex' ||
		e === 'mojeek'
	)
		return e;
	return 'duckduckgo';
}

function buildSearchUrl(engine: SearchEngine, query: string, count: number): string {
	const q = encodeURIComponent(query);
	if (engine === 'google') {
		return `https://www.google.com/search?q=${q}&hl=tr&num=${count}&pws=0&safe=active&udm=14`;
	}
	if (engine === 'bing') return `https://www.bing.com/search?q=${q}&count=${count}&setlang=tr-tr`;
	if (engine === 'duckduckgo') return `https://duckduckgo.com/html/?q=${q}`;
	if (engine === 'ecosia') return `https://www.ecosia.org/search?q=${q}`;
	if (engine === 'startpage') return `https://www.startpage.com/sp/search?query=${q}`;
	if (engine === 'qwant') return `https://www.qwant.com/?q=${q}&t=web`;
	if (engine === 'yahoo') return `https://search.yahoo.com/search?p=${q}`;
	if (engine === 'yandex') return `https://yandex.com/search/?text=${q}`;
	return `https://www.mojeek.com/search?q=${q}`;
}

function tryDecodeGoogleRedirect(href: string): string {
	if (!href) return '';
	if (!href.startsWith('/url?')) return href;
	try {
		const u = new URL(`https://www.google.com${href}`);
		const q = u.searchParams.get('q');
		if (q) return q;
		const url = u.searchParams.get('url');
		if (url) return url;
		return href;
	} catch {
		return href;
	}
}

function normalizeUrl(url: string): string {
	if (!url) return '';
	if (url.startsWith('//')) return `https:${url}`;
	return url;
}

async function fetchHtml(targetUrl: string, userAgent: string, proxyUrl?: string): Promise<string> {
	const dispatcher = proxyUrl ? new ProxyAgent(proxyUrl) : undefined;

	const init: any = {
		headers: {
			'User-Agent': userAgent,
			'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
			'Accept-Language': 'tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7'
		},
		redirect: 'follow',
		dispatcher
	};

	const res = await fetch(targetUrl, init);

	if (!res.ok) {
		const text = await res.text().catch(() => '');
		throw new Error(`Upstream error ${res.status}: ${text.slice(0, 200)}`);
	}

	return await res.text();
}

function parseGoogle(html: string, count: number): SearchResult[] {
	const $ = cheerio.load(html);
	const results: SearchResult[] = [];

	$('#search .g, #search .MjjYud').each((_, el) => {
		const title = $(el).find('h3').first().text().trim();
		const rawHref = $(el).find('a:has(h3)').first().attr('href')?.trim() ?? $(el).find('a').first().attr('href')?.trim() ?? '';
		const url = normalizeUrl(tryDecodeGoogleRedirect(rawHref));
		const description = $(el)
			.find('div.VwiC3b, div.IsZvec, div[data-sncf], span.aCOpRe, .MUxGbd')
			.first()
			.text()
			.trim();
		if (title && url) results.push({ title, url, description });
	});

	return results.slice(0, count);
}

function parseBing(html: string, count: number): SearchResult[] {
	const $ = cheerio.load(html);
	const results: SearchResult[] = [];

	$('li.b_algo').each((_, el) => {
		const a = $(el).find('h2 a').first();
		const title = a.text().trim();
		const url = a.attr('href')?.trim() ?? '';
		const description = $(el).find('.b_caption p').first().text().trim();
		if (title && url) results.push({ title, url, description });
	});

	return results.slice(0, count);
}

function parseYahoo(html: string, count: number): SearchResult[] {
	return parseBing(html, count);
}

function parseEcosia(html: string, count: number): SearchResult[] {
	return parseBing(html, count);
}

function parseStartpage(html: string, count: number): SearchResult[] {
	const $ = cheerio.load(html);
	const results: SearchResult[] = [];

	$('a.w-gl__result-title, a.result-link, a[href][data-testid="result-title"]').each((_, el) => {
		const a = $(el);
		const title = a.text().trim();
		const url = normalizeUrl(a.attr('href')?.trim() ?? '');
		const container = a.closest('article, .w-gl__result, .result, li');
		const description = container.find('.w-gl__description, .result__snippet, p').first().text().trim();
		if (title && url) results.push({ title, url, description });
	});

	return results.slice(0, count);
}

function parseQwant(html: string, count: number): SearchResult[] {
	const $ = cheerio.load(html);
	const results: SearchResult[] = [];

	$('a[data-testid="web-result-title"], a.result__title, a[href].result--web__title-link').each((_, el) => {
		const a = $(el);
		const title = a.text().trim();
		const url = normalizeUrl(a.attr('href')?.trim() ?? '');
		const container = a.closest('article, .result, li');
		const description = container.find('[data-testid="web-result-description"], .result__description, p').first().text().trim();
		if (title && url) results.push({ title, url, description });
	});

	return results.slice(0, count);
}

function parseYandex(html: string, count: number): SearchResult[] {
	const $ = cheerio.load(html);
	const results: SearchResult[] = [];

	$('.serp-item, li.serp-item').each((_, el) => {
		const a = $(el).find('a.Link, a.link, h2 a, a').first();
		const title = $(el).find('h2, .OrganicTitle, .title').first().text().trim() || a.text().trim();
		const url = normalizeUrl(a.attr('href')?.trim() ?? '');
		const description = $(el).find('.OrganicTextContentSpan, .text-container, .organic__content-wrapper, p').first().text().trim();
		if (title && url) results.push({ title, url, description });
	});

	return results.slice(0, count);
}

function parseMojeek(html: string, count: number): SearchResult[] {
	const $ = cheerio.load(html);
	const results: SearchResult[] = [];

	$('.results .result, li.result').each((_, el) => {
		const a = $(el).find('a').first();
		const title = $(el).find('h2, h3').first().text().trim() || a.text().trim();
		const url = normalizeUrl(a.attr('href')?.trim() ?? '');
		const description = $(el).find('.snippet, p').first().text().trim();
		if (title && url) results.push({ title, url, description });
	});

	return results.slice(0, count);
}

function parseDuckDuckGo(html: string, count: number): SearchResult[] {
	const $ = cheerio.load(html);
	const results: SearchResult[] = [];

	$('.results .result').each((_, el) => {
		const a = $(el).find('a.result__a').first();
		const title = a.text().trim();
		const url = normalizeUrl(a.attr('href')?.trim() ?? '');
		const description = $(el).find('.result__snippet').first().text().trim();
		if (title && url) results.push({ title, url, description });
	});

	return results.slice(0, count);
}

function parseSerp(engine: SearchEngine, html: string, count: number): SearchResult[] {
	if (engine === 'google') return parseGoogle(html, count);
	if (engine === 'bing') return parseBing(html, count);
	if (engine === 'duckduckgo') return parseDuckDuckGo(html, count);
	if (engine === 'ecosia') return parseEcosia(html, count);
	if (engine === 'startpage') return parseStartpage(html, count);
	if (engine === 'qwant') return parseQwant(html, count);
	if (engine === 'yahoo') return parseYahoo(html, count);
	if (engine === 'yandex') return parseYandex(html, count);
	return parseMojeek(html, count);
}

export const GET: RequestHandler = async ({ url, request }) => {
	const query = url.searchParams.get('q')?.trim() ?? '';
	const engine = normalizeEngine(url.searchParams.get('engine'));
	const count = clampCount(url.searchParams.get('count'));
	const proxyUrl = getAllowedProxyUrl(url.searchParams.get('proxyUrl'));

	if (!query) {
		return json({ ok: false, error: 'q gerekli' }, { status: 400 });
	}

	const ipHash = hashIp(getClientIp(request));
	const rl = checkRateLimit(ipHash);
	if (rl.ok === false) {
		return json(
			{ ok: false, error: 'Rate limit aşıldı', retryAfterSeconds: rl.retryAfterSeconds },
			{ status: 429, headers: { 'Retry-After': String(rl.retryAfterSeconds) } }
		);
	}

	try {
		const userAgent = pickUserAgent();
		const targetUrl = buildSearchUrl(engine, query, count);
		const html = await fetchHtml(targetUrl, userAgent, proxyUrl);
		const results = parseSerp(engine, html, count);

		return json({ ok: true, engine, query, results });
	} catch (err) {
		const message = err instanceof Error ? err.message : 'Unknown error';
		return json({ ok: false, error: 'Upstream parse/fetch hatası', details: message }, { status: 502 });
	}
};
