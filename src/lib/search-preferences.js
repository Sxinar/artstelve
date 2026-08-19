import { BANG_COMMANDS } from '$lib/bangs.js';

export function normaliseDomain(value) {
    try {
        const candidate = value.includes('://') ? value : `https://${value}`;
        return new URL(candidate).hostname.replace(/^www\./i, '').toLowerCase();
    } catch {
        return '';
    }
}

export function resolveBang(trigger, customBangs = []) {
    const key = trigger.toLowerCase();
    return customBangs.find((bang) => bang.trigger.toLowerCase() === key) || BANG_COMMANDS[key] || null;
}

export function buildBangUrl(bang, searchTerms) {
    const encoded = encodeURIComponent(searchTerms);
    const template = bang.urlTemplate || bang.url;
    return template.includes('{searchTerms}')
        ? template.replaceAll('{searchTerms}', encoded)
        : `${template}${encoded}`;
}
