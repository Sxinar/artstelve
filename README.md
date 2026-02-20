# 🔍 Artado Search

Artado Search (eski adıyla Artstelve), gizlilik odaklı, yüksek performanslı ve modern bir hibrit arama motorudur. SvelteKit ve Svelte 5 altyapısı ile geliştirilen bu proje, kullanıcıların verilerini takip etmeden birden fazla kaynaktan gelen sonuçları en hızlı şekilde sunmayı hedefler.

## ✨ Temel Özellikler

### 🛡️ Gizlilik ve Güvenlik
- **Sıfır Takip**: Kullanıcı sorguları, IP adresleri veya davranışsal veriler asla kaydedilmez.
- **Güvenli Render**: Tüm arama sonuçları XSS saldırılarına karşı sanitize edilerek sunulur.
- **Proxy Katmanı**: Sonuçlar, kaynak sitelerden Artado Proxy aracılığıyla anonimleştirilerek çekilir.

### 🚀 Performans
- **Svelte 5 & Vite**: En yeni web teknolojileri ile ışık hızında sayfa geçişleri.
- **Hibrit Arama**: Brave, DuckDuckGo, Google, Bing ve daha birçok motorun gücünü tek bir noktada birleştirir.
- **Akıllı Önbellekleme**: Sık yapılan aramalar hem sunucu hem de CDN seviyesinde önbelleğe alınır.

### 🎨 Kullanıcı Deneyimi (UX)
- **Akıllı Otomatik Tamamlama**: Yazmaya başladığınız anda Türkçe karakter uyumlu öneriler.
- **Yazım Denetimi**: "Bunu mu demek istediniz?" özelliği ile hatalı sorgular için anında düzeltme önerisi.
- **Premium Tasarım**: Karanlık mod desteği, mikro-animasyonlar ve özelleştirilebilir vurgu renkleri.
- **Modern Bilgi Kartları**: Wikipedia ve diğer kaynaklardan gelen zengin infobox'lar.


## 🛠️ Teknik Mimari

### Frontend
- **Framework**: SvelteKit (Svelte 5 tabanlı)
- **Styling**: Modern CSS (Vanilla), Flexbox, Grid
- **State Management**: Svelte Stores ve Context API
- **İkonlar**: FontAwesome 5

### Backend (API Katmanı)
- **Search API**: Birden fazla motoru yöneten ve sonuçları normalize eden yapı.
- **Suggest API**: Google Suggest API'sini `windows-1254` kodlaması ile Türkiye lokasyonuna özel işleyen servis.
- **Workshop API**: Bulut tabanlı tema ve eklenti yönetim sistemi.

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

Artado Search'ü tarayıcınızın varsayılan arama motoru yapmak için:

1. **Chrome / Edge**: beta.artadosearch.com adresini bir kez ziyaret edin. Tarayıcı ayarlarında (Arama Motorlarını Yönet) Artado Search otomatik olarak görünecektir. Görünmüyorsa manuel ekle diyerek şu sorgu URL'sini kullanın: `https://beta.artadosearch.com/search?i=%s`
2. **Firefox**: Adres çubuğundaki üç noktaya (veya logo yanındaki büyütece) tıklayıp "Artado Search Ekle" seçeneğini kullanın.
3. **OpenSearch**: Proje içerisinde `static/opensearch.xml` dosyası ile tarayıcılarla tam uyumluluk sağlanmaktadır.

## 📦 Proje Yapısı

```text
/src
  /lib          # Paylaşılan yardımcı fonksiyonlar ve store'lar
  /routes       # SvelteKit sayfaları ve API uç noktaları
    /api/search # Arama motoru mantığı
    /api/suggest# Öneri ve yazım denetimi
    /settings   # Ayarlar sayfası
    /search     # Sonuç sayfası
/static         # Logo, favicon ve opensearch.xml
```

## 📄 Lisans

Bu proje **MIT Lisansı** altında korunmaktadır.

---
*Geliştiren: [Sxinar](https://github.com/Sxinar)*
