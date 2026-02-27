# 🔍 Artado Search

Artado Search, gizlilik odaklı, yüksek performanslı ve modern bir arama motorudur. SvelteKit ve Svelte 5 altyapısı ile geliştirilen bu proje, kullanıcıların verilerini takip etmeden birden fazla kaynaktan gelen sonuçları en hızlı şekilde sunmayı hedefler.

## ✨ Temel Özellikler

### 🛡️ Gizlilik ve Güvenlik
- **Sıfır Takip**: Kullanıcı sorguları, IP adresleri veya davranışsal veriler asla kaydedilmez
- **Güvenli Render**: Tüm arama sonuçları XSS saldırılarına karşı sanitize edilerek sunulur
- **Proxy Katmanı**: Sonuçlar, kaynak sitelerden Artado Proxy aracılığıyla anonimleştirilerek çekilir

### 🚀 Performans
- **Svelte 5 & Vite**: En yeni web teknolojileri ile ışık hızında sayfa geçişleri
- **Hibrit Arama**: DuckDuckGo, Brave, Startpage, Qwant, Mojeek, Ask ve Marginalia gibi birden fazla motorun gücünü tek bir noktada birleştirir
- **Akıllı Önbellekleme**: Sık yapılan aramalar hem sunucu hem de CDN seviyesinde önbelleğe alınır

### 🎨 Kullanıcı Deneyimi (UX)
- **Akıllı Otomatik Tamamlama**: Yazmaya başladığınız anda Türkçe karakter uyumlu öneriler
- **Yazım Denetimi**: "Bunu mu demek istediniz?" özelliği ile hatalı sorgular için anında düzeltme önerisi
- **Özelleştirilebilir Tasarım**: Karanlık mod desteği, animasyonlar ve özelleştirilebilir vurgu renkleri
- **Workshop Logoları**: Kullanıcılar tarafından oluşturulan özel logo tasarımları
- **Modern Bilgi Kartları**: Wikipedia kaynaklarından gelen infobox'lar

### ⚡ Bang Komutları
- **Hızlı Arama**: Bang komutları ile farklı platformlarda hızlı arama yapın
- **Yeni Sekmede Açılır**: Bang komutları yeni sekmede açılır, mevcut sekme korunur
- **27+ Komut**: Google, DuckDuckGo, YouTube, Wikipedia, GitHub, Twitter, Facebook, Reddit, Stack Overflow, NPM, PyPI, Docker Hub, AWS, Azure, Google Cloud ve daha fazlası
- **Kategori Bazlı**: Arama motorları, sosyal medya, geliştirme, referans, bulut hizmetleri, haberler, haritalar ve araçlar

## 🛠️ Teknik Mimari

### Frontend
- **Framework**: SvelteKit (Svelte 5 tabanlı)
- **Styling**: Modern CSS (Vanilla), Flexbox, Grid
- **State Management**: Svelte Stores ve Context API
- **İkonlar**: FontAwesome 5

### Backend (API Katmanı)
- **Search API**: Birden fazla motoru yöneten ve sonuçları normalize eden yapı
- **Suggest API**: Google Suggest API'sini `windows-1254` kodlaması ile Türkiye lokasyonuna özel işleyen servis
- **Workshop API**: Bulut tabanlı logo yönetim ve yayınlama sistemi
- **Proxy Entegrasyonu**: Artado Proxy (`https://artadoproxy.vercel.app`) üzerinden tüm arama sonuçları

## ⚙️ Kurulum Rehberi

### Gereksinimler
- Node.js >= 20.x
- npm, pnpm veya yarn

### Adımlar
1. Depoyu klonlayın:
   ```bash
   git clone https://github.com/Sxinar/artstelve.git
   cd artstelve
   ```
2. Bağımlılıkları yükleyin:
   ```bash
   npm install
   ```
3. Geliştirme sunucusunu başlatın:
   ```bash
   npm run dev
   ```
4. Tarayıcınızda açın: `http://localhost:5173`

## 🌍 Tarayıcıya Ekleme (Varsayılan Arama Motoru)

Artado Search'ü tarayıcınızın varsayılan arama motoru olarak ayarlamak için:

### Chrome / Edge
1. Tarayıcınızın adres çubuğuna `http://localhost:5173` adresini girin
2. Tarayıcı ayarlarında (Arama Motorlarını Yönet) Artado Search'ü varsayılan olarak ayarlayın
3. Alternatif olarak, manuel ekleme seçeneğini kullanarak şu sorgu URL'sini girin: `http://localhost:5173/search?i=%s`

### Firefox
1. Adres çubuğundaki üç noktaya (veya logo yanındaki büyütece) tıklayın
2. "Arama Motorlarını Yönet" seçeneğine gidin
3. "Artado Search Ekle" seçeneğini kullanın
4. Veya OpenSearch XML dosyasını doğrudan tarayıcıya yükleyin

### OpenSearch Entegrasyonu
Proje, tarayıcılarla tam uyumluluk sağlayan `static/opensearch.xml` dosyası içerir. Bu dosya, Artado Search'ü tarayıcınıza varsayılan arama motoru olarak eklemenizi kolaylaştırır.

## 📦 Proje Yapısı

```text
/src
  /lib          # Paylaşılan yardımcı fonksiyonlar ve store'lar
  /routes       # SvelteKit sayfaları ve API uç noktaları
    /api/search # Arama motoru mantığı (proxy entegrasyonu)
    /api/suggest # Öneri ve yazım denetimi
    /workshop    # Workshop API (logolar)
    /settings   # Ayarlar sayfası
    /search     # Sonuç sayfası
    /logos      # Logolar sayfası
  /static         # Logo, favicon ve opensearch.xml
```

## 🎯 Kullanım Kılavuzu

### Bang Komutları
Bang komutları, farklı platformlarda hızlı arama yapmanızı sağlayan kısayollardır. Kullanımı:

```
!g test         → Google'da ara
!ddg search      → DuckDuckGo'da ara
!yt music       → YouTube'da ara
!w türkiye     → Wikipedia'da ara
!gh react       → GitHub'ta ara
!tw news        → Twitter'da ara
!fb search      → Facebook'ta ara
!rd programming → Reddit'te ara
!so javascript  → Stack Overflow'da ara
!npm express    → NPM'de ara
!pypi requests  → PyPI'de ara
!docker nginx    → Docker Hub'ta ara
!aws lambda      → AWS'te ara
!translate merhaba → Çeviri yap
!weather istanbul → Hava durumunu göster
!time london    → Saat göster
```

### Ayarlar
- **Temel Ayarlar**: Otomatik tamamlama, güvenli arama, bölge ayarları
- **Görünüm**: Tema modu, köşe yuvarlaklığı, vurgu rengi
- **Hybrid Proxy**: Proxy URL, motorlar, limitler, önbellekleme
- **Bangs**: Bang komutları listesi ve açıklamalar
- **Workshop**: Özel logo tasarımları

## 📄 Lisans

Bu proje **MIT Lisansı** altında korunmaktadır.

---
*Geliştiren: [Sxinar](https://github.com/Sxinar)*
