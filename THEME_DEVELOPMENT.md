# Artado Search tema geliştirme rehberi

Bu belge Artado Search için yalnızca **CSS tabanlı görsel tema** hazırlamak içindir. Tema; sayfanın davranışını değiştirmez, JavaScript eklemez, sonuçlara içerik enjekte etmez ve uzantı çalıştırmaz. Renk, tipografi, boşluk, kenarlık, gölge ve bileşen durumlarını değiştirir.

Devs Workshop'a yüklemeye hazır on örnek tema için proje kökündeki `theme-pack/README.md` dosyasına ve aynı klasördeki CSS dosyalarına bakın.

## Başlamadan önce

Temayı **Ayarlar → Özel CSS** alanına yapıştırın. CSS uygulama genelinde `head` içine eklenir; bu nedenle ana sayfa, arama sonuçları, yan menü ve ayarlar ekranında etkilidir.

Temalarda sabit `id` hedefleri kullanılmaz. Uygulamada aynı bileşen birden fazla kez bulunabilir; bu yüzden kararlı, tekrar kullanılabilir sınıflar (`class`) tema API’sidir. Bir bileşenin `id` değeri varsa dahi, bu değer davranış veya erişilebilirlik için ayrılmış olabilir; tema seçicisi olarak kullanmayın.

İlk deneme için aşağıdaki tam temayı kullanabilirsiniz:

```css
/* Gece Mürekkebi — başlangıç teması */
:root {
  --background-color: #101522;
  --card-background: #171f30;
  --input-background: #111a2a;
  --text-color: #edf2ff;
  --text-color-secondary: #a8b5cb;
  --border-color: #2b3a58;
  --hover-background: rgba(126, 164, 255, .12);
  --primary-color: #7ea4ff;
  --primary-color-dark: #5d83dc;
  --primary-color-light: rgba(126, 164, 255, .20);
  --primary-color-rgb: 126, 164, 255;
  --link-color: #aec5ff;
  --link-color-visited: #d0afe9;
  --danger-color: #ff8b96;
}

.home-container,
.search-results-page,
.settings-page { background: var(--background-color); }

.search-box,
.result-item-card,
.widget-card,
.setting-card,
.sidebar { border-color: var(--border-color); }

.search-box:focus-within,
.text-input:focus-visible,
select:focus-visible {
  outline: 3px solid var(--primary-color-light);
  outline-offset: 2px;
  border-color: var(--primary-color);
}
```

## Tema altyapısı ve değişkenler

Önce değişkenleri değiştirin; tek tek kutuları boyamak yerine bu yaklaşım tüm arayüzün tutarlı kalmasını sağlar.

| Değişken | Etkilediği alan | Kullanım notu |
| --- | --- | --- |
| `--background-color` | Sayfa zemini | Ana zemin rengi |
| `--card-background` | Kartlar, paneller, ayarlar | Zeminden ayırt edilir olmalı |
| `--input-background` | Arama/form alanları | Metinle yeterli kontrast sağlamalı |
| `--text-color` | Başlıklar ve ana metin | Kontrast hedefi en az 4.5:1 |
| `--text-color-secondary` | Açıklama, URL, yardımcı metin | Soluk ama okunur bir ton |
| `--border-color` | Çerçeve ve ayırıcılar | Zemin üzerinde görünür olmalı |
| `--hover-background` | Hover ve seçili yüzey | Genellikle yarı saydam aksan |
| `--primary-color` | Birincil eylem, aktif sekme | Temanın vurgu rengi |
| `--primary-color-dark` | Birincil hover/pressed | Birincilden daha koyu ton |
| `--primary-color-light` | Odak halkası, yumuşak vurgu | Saydam renk kullanın |
| `--primary-color-rgb` | `rgba(var(--primary-color-rgb), …)` | `126, 164, 255` biçiminde RGB |
| `--link-color` | Bağlantılar | Metinden açıkça ayırt edilmeli |
| `--link-color-visited` | Ziyaret edilmiş bağlantılar | Link renginden farklı, okunur ton |
| `--danger-color` | Silme/hata eylemleri | Her modda erişilebilir kırmızı |
| `--disabled-background` | Devre dışı alanlar | İsteğe bağlı, düşük kontrastlı yüzey |

Yerleşik tema seçimi `body` üzerine şu sınıflardan birini ekler: `klasik`, `koyu`, `mavi`, `pastel`, `doga`, `terminal`, `gece-yarisi`, `gunesli`, `retro`, `komur`, `okyanus`. Sistem modu ayrıca `body.light` veya `body.dark` ekler.

```css
/* Yalnızca yerleşik Terminal temasını düzeltme örneği */
body.terminal .result-item-card { box-shadow: none; }

/* Sistem tercihi için tema varyantı */
@media (prefers-color-scheme: dark) {
  :root { --card-background: #171f30; }
}
```

## Seçici sözleşmesi: kutular, sınıflar ve durumlar

### Ortak kabuk ve yan menü

| Görünür alan | Ana sınıf | Alt hedef / durum |
| --- | --- | --- |
| Yan menü | `.sidebar` | Açık: `.sidebar.open` |
| Menü başlığı | `.sidebar-header` | İç düzen: `.header-content`, başlık: `.sidebar-header h2` |
| Menü içeriği | `.sidebar-content` | Bölüm: `.sidebar-section` |
| Bölüm metni | `.section-title`, `.section-desc` | Yardımcı metin için `.section-desc` |
| Seçim alanı | `.select-wrapper` | İkon: `.dropdown-icon` |
| Menü bağlantıları | `.sidebar-links a` | İkon: `.sidebar-links a .icon`; durum: `:hover`, `:focus-visible` |
| Kapat düğmesi | `.close-sidebar` | `:hover`, `:focus-visible` |
| Sayfa örtüsü | `.overlay` | Menü açıkken görünür |
| Alt bilgi | `.footer`, `.footer-content` | Ayar bağlantısı: `.footer-settings-link` |
| Alt bilgi bağlantıları | `.footer-nav a` | Eylem düğmesi: `.footer-action-btn` |

```css
.sidebar {
  background: color-mix(in srgb, var(--card-background) 94%, #526ba9);
  border-right: 1px solid var(--border-color);
}
.sidebar-links a:hover,
.sidebar-links a:focus-visible {
  color: var(--primary-color);
  background: var(--hover-background);
}
```

### Ana sayfa

| Görünür alan | Ana sınıf | Alt hedef / durum |
| --- | --- | --- |
| Sayfa kapsayıcısı | `.home-container` | Varyantlar: `.modern`, `.artistic` |
| Üst alan | `.home-header` | Menü düğmesini içerir |
| Logo alanı | `.logo-container` | Görsel: `.logo`, açıklama: `.subtitle` |
| Arama grubu | `.search-container` | Ana kutu: `.search-box` |
| Arama kutusu | `.search-box` | Odak: `.search-box:focus-within` |
| Metin alanı | `.search-input` | Yer tutucu: `.search-input::placeholder` |
| Arama simgesi | `.search-icon` | Renk ve boyut hedefi |
| Eylem düğmeleri | `.clear-button`, `.mic-button`, `.search-action-button` | Dinleme: `.mic-button.listening` |
| Öneri kutusu | `.suggestions-dropdown` | Başlık: `.suggestions-header` |
| Öneri satırı | `.suggestion-item` | Klavye seçimi: `.suggestion-item.focused` |
| Hızlı sonuçlar | `.results`, `.result-item` | Başlık/URL/metin: `.result-title`, `.result-url`, `.result-description` |

```css
.home-container {
  background: radial-gradient(circle at top, #1b2948 0, var(--background-color) 42rem);
}
.search-box {
  background: var(--input-background);
  border: 1px solid var(--border-color);
  border-radius: 18px;
}
.search-box:focus-within {
  border-color: var(--primary-color);
  box-shadow: 0 0 0 4px var(--primary-color-light);
}
```

### Arama sonuçları

| Görünür alan | Ana sınıf | Alt hedef / durum |
| --- | --- | --- |
| Sonuç sayfası | `.search-results-page` | Sayfanın genel zemini |
| Başlık çubuğu | `.search-header` | Logo bağlantısı: `.logo-link`; logo: `.header-logo` |
| Başlıktaki arama | `.search-bar-container`, `.input-wrapper` | Girdi: `.search-input`; düğme: `.search-button-header` |
| Sonuç türü sekmeleri | `.search-type-nav` | İç düzen: `.search-type-nav-inner`; aktif: `.search-type-nav button.active` |
| İçerik kolonu | `.search-main-content`, `.results-container` | Görsel düzen: `.images-mode` |
| Web listesi | `.results-list.web-results` | Görünüm: `.view-grid` veya `.view-list` |
| Sonuç kartı | `.result-item-card` | Durum: `.result-item-card:hover` |
| Sonuç başlığı | `.result-header`, `.result-title` | Site ikonu: `.favicon` |
| URL/açıklama | `.result-url`, `.result-snippet` | Bağlantı: `.result-title a` |
| Yazım önerisi | `.did-you-mean-banner` | Bağlantı: `.did-you-mean-link`, `.original-search-link` |
| Bilgi kutusu | `.infobox-container`, `.infobox-card` | Görsel: `.infobox-image` |
| Yan araçlar | `.widgets-row`, `.widgets-right-col`, `.widget-card` | Başlık: `.widget-header`; içerik: `.widget-body` |
| Yüklenme/hata | `.search-skeleton`, `.skeleton-card`, `.error-container` | Yenileme: `.refresh-btn` |

```css
.result-item-card {
  background: var(--card-background);
  border: 1px solid var(--border-color);
  border-radius: 14px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, .08);
  transition: transform .2s ease, border-color .2s ease;
}
.result-item-card:hover {
  border-color: var(--primary-color);
  transform: translateY(-2px);
}
.result-title a,
.infobox-card a { color: var(--link-color); }
```

### Ayarlar, temalar ve formlar

| Görünür alan | Ana sınıf | Alt hedef / durum |
| --- | --- | --- |
| Ayarlar sayfası | `.settings-page` | Üst alan: `.settings-header`, başlık: `.settings-title` |
| Sayfa düzeni | `.settings-content-wrapper` | Ana içerik: `.settings-main-content` |
| Ayar menüsü | `.settings-sidebar` | Aktif öğe: `.settings-sidebar button.active`, `.settings-sidebar a.active` |
| Ayar bölümü | `.section-heading` | Bölüm başlığı |
| Ayar kartı | `.setting-card` | Satır: `.setting-row`; açıklama: `.setting-info` |
| Birincil düğme | `.button` | Varyantlar: `.primary`, `.secondary`, `.danger`, `.small` |
| Metin/form alanı | `.text-input`, `select`, `textarea` | Odak: `:focus-visible` |
| Anahtar | `.switch` | Açık: `input:checked + .slider` |
| Tema düğmesi | `.theme-button` | Seçili: `.theme-button.active`; önizleme: `.theme-preview-box` |
| Logo seçimi | `.logo-grid`, `.logo-option` | Seçili: `.logo-option.active`; önizleme: `.logo-preview` |
| Workshop kartları | `.workshop-mini-grid`, `.mini-item` | Bilgi: `.mini-info`; eylem: `.mini-info button` |

```css
.setting-card,
.theme-button,
.logo-option {
  background: var(--card-background);
  border: 1px solid var(--border-color);
  border-radius: 16px;
}
.settings-sidebar button.active,
.settings-sidebar a.active,
.theme-button.active,
.logo-option.active {
  color: var(--primary-color);
  background: var(--primary-color-light);
  border-color: var(--primary-color);
}
```

## Tasarım reçeteleri

### Cam yüzey

`backdrop-filter` desteklenmese de okunurluğu korumak için opak bir arka plan rengi bırakın.

```css
.sidebar,
.result-item-card,
.widget-card {
  background: rgba(23, 31, 48, .78);
  border: 1px solid rgba(255, 255, 255, .13);
  backdrop-filter: blur(16px);
}
```

### Kompakt ya da ferah düzen

Uygulama ölçek değişkenlerini kullanıyorsa tema içinden uyarlayabilirsiniz:

```css
:root { --density-scale: .9; --radius-base: 8px; } /* kompakt */
/* :root { --density-scale: 1.1; --radius-base: 16px; } ferah */
```

### Hareketi erişilebilir tutmak

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: .01ms !important;
    transition-duration: .01ms !important;
    scroll-behavior: auto !important;
  }
}
```

## Güvenli tema kuralları

- Yalnızca CSS yazın. `<script>`, haricî dosya, olay dinleyicisi veya içerik enjeksiyonu desteklenmez.
- `button`, `input` ya da `a` gibi genel seçiciler yerine bileşen sınıfını kullanın. Örneğin `.search-action-button` veya `.settings-sidebar button`.
- `!important` son çaredir. Önce daha dar bir seçici deneyin.
- Klavye odağını kaldırmayın. `outline: none` kullanmak zorundaysanız karşılığında güçlü bir `:focus-visible` stili ekleyin.
- Koyu temada URL, placeholder, ikincil metin ve devre dışı durumların kontrastını ayrı kontrol edin.
- Yeni bir bileşen eklerken, tema için anlamlı ve kalıcı bir sınıf sağlayın. Rastgele veya davranışsal `id` üretmeyin.

## Yayın öncesi kontrol listesi

- [ ] Ana sayfa: arama alanı, öneriler, ses düğmesi ve hızlı sonuçlar okunaklı.
- [ ] Sonuçlar: web/görsel/video/haber sekmeleri ile sonuç kartları ayırt ediliyor.
- [ ] Yan menü: açık, kapalı, hover ve klavye odağı durumları görünür.
- [ ] Ayarlar: aktif menü, form alanları, anahtarlar ve tehlikeli düğmeler açıkça anlaşılır.
- [ ] Açık/koyu sistem tercihinde metin ve bağlantı kontrastı yeterli.
- [ ] 320 px, 768 px ve masaüstü genişlikte yatay taşma yok.
- [ ] Azaltılmış hareket tercihi etkinken dikkat dağıtan animasyon çalışmıyor.

## Kaynak eşlemesi

Seçici sözleşmesini değiştirirken şu dosyaları birlikte güncelleyin:

- Ana sayfa: `src/routes/+page.svelte`
- Arama sonuçları: `src/routes/search/+page.svelte`
- Ortak kabuk ve yan menü: `src/routes/+layout.svelte`
- Ayarlar ve Özel CSS: `src/routes/settings/+page.svelte`
- Yerleşik paletler: `src/global.css`
