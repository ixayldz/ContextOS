# ContextOS Kullanım Kılavuzu

## ContextOS Nedir?

ContextOS, yapay zeka kodlama asistanlarına (ChatGPT, Claude, Gemini, Cursor vb.) projenizi anlatırken **en önemli dosyaları otomatik olarak seçen** bir altyapıdır.

### Problemi Anlamak

Bir yapay zekaya kod yardımı için başvurduğunuzda şöyle bir ikilemle karşılaşırsınız:

```
Senaryo 1: Tüm projeyi yapıştırıyorsunuz
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
❌ Token israfı (parasal maliyet)
❌ Gereksiz dosyalar modeli şaşırtıyor
❌ Önemli bilgiler uzun metin içinde kayboluyor

Senaryo 2: Dosyaları elle seçiyorsunuz
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
❌ Zaman kaybı
❌ Bağımlılıkları kaçırma riski
❌ Her seferinde aynı işi tekrarlama

Senaryo 3: Modelin tahmin etmesini bekliyorsunuz
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
❌ Yanlış dosyaları ister
❌ "Halüsinasyon" yapar
❌ Eksik context ile hatalı kod üretir
```

### ContextOS'un Çözümü

ContextOS bu üç sorunu tek hamlede çözer:

```
Siz: "AuthController'a rate limiting ekle"
        │
        ▼
┌─────────────────────────────────────────┐
│           ContextOS Motoru              │
│                                         │
│  1. Hedefinizi analiz eder              │
│  2. İlgili dosyaları AKILLI şekilde bulur│
│  3. Token bütçesine göre optimize eder  │
│  4. Temiz bir context paketi oluşturur  │
└─────────────────────────────────────────┘
        │
        ▼
📄 Optimize edilmiş context (sadece gerekli dosyalar)
   - AuthController.ts
   - RateLimitMiddleware.ts  
   - AuthService.ts
   - config/security.yaml
```

---

## Nasıl Çalışıyor?

### 1. Akıllı Dosya Seçimi (Hibrit Sıralama)

ContextOS, hangi dosyaların önemli olduğuna karar verirken **üç farklı sinyal** kullanır:

| Sinyal | Ağırlık | Açıklama |
|--------|---------|----------|
| **Semantik Benzerlik** | %40 | Hedefinizle aynı konuyu içeren dosyalar |
| **Bağımlılık Mesafesi** | %40 | Hedef dosyanın import ettiği dosyalar |
| **Özel Kurallar** | %20 | Sizin tanımladığınız kısıtlamalar |

**Örnek:** "AuthController'a rate limiting ekle" dediğinizde:

```
AuthController.ts
├── Semantik: 0.95 (auth kelimesi geçiyor)
├── Bağımlılık: 1.00 (doğrudan hedef)
├── Kurallar: 0.80 (controller klasöründe)
└── TOPLAM SKOR: 0.92 ⭐ DAHİL EDİLİR

logger.ts
├── Semantik: 0.10 (alakasız)
├── Bağımlılık: 0.20 (3 adım uzakta)
├── Kurallar: 0.00 (kural yok)
└── TOPLAM SKOR: 0.14 ❌ HARİÇ TUTULUR
```

### 2. Token Bütçeleme

Her yapay zeka modelinin bir token limiti vardır. ContextOS, seçilen dosyaları bu limite sığdırır:

```
Hedef: GPT-4 (128K token limit)
Mevcut dosyalar: 50 dosya, 200K token

ContextOS:
├── En yüksek skorlu 20 dosya alınır
├── Toplam: 45K token
└── Kalan: 83K token (soru ve yanıt için)
```

### 3. RLM Motoru (Gelişmiş)

ContextOS, MIT'nin **Recursive Language Model (RLM)** araştırmasını uygular. Bu ne demek?

```
Geleneksel: LLM(dosyalar + soru) → cevap

RLM: LLM(soru) → kod yaz → çalıştır → gözlemle → tekrarla
```

Model, projenizi "keşfetmek" için kod yazabilir:

```javascript
// Model bunu yazar
const authFiles = ctx.find('**/auth/**/*.ts');
const deps = ctx.getDependencies('AuthService');

// ContextOS bunu güvenli sandbox'ta çalıştırır
// Model sonucu görür ve daha iyi context oluşturur
```

---

## Kurulum

### Gereksinimler

- Node.js 18 veya üzeri
- pnpm, npm veya yarn
- (Opsiyonel) Bir AI API anahtarı (Gemini, OpenAI veya Anthropic)

### Yeni Proje için Kurulum

```bash
# 1. Global olarak CLI'ı kurun
npm install -g @contextos/cli

# 2. Yeni proje klasörü oluşturun
mkdir my-new-project
cd my-new-project

# 3. Projenizi başlatın (Node.js, Python vb.)
npm init -y

# 4. ContextOS'u başlatın
ctx init

# 5. API anahtarınızı ayarlayın (opsiyonel ama önerilen)
export GEMINI_API_KEY="your-api-key"
```

### Mevcut Projeye Ekleme

```bash
# 1. Proje klasörünüze gidin
cd /path/to/your/existing-project

# 2. CLI'ı global olarak kurun (henüz yapmadıysanız)
npm install -g @contextos/cli

# 3. ContextOS'u başlatın
ctx init

# Init komutu şunları yapar:
# - .contextos/ klasörü oluşturur
# - Proje tipini otomatik algılar (TypeScript, Python, Go vb.)
# - Varsayılan ayarları oluşturur
```

---

## Günlük Kullanım

### Temel İş Akışı

```bash
# 1. Projenizi indeksleyin (ilk seferde veya büyük değişikliklerden sonra)
ctx index

# 2. Hedefinizi belirtin ve context oluşturun
ctx goal "Kullanıcı doğrulama sistemine 2FA ekle"

# 3. Context'i panoya kopyalayın
ctx copy

# 4. Yapay zeka asistanınıza yapıştırın ve sorunuzu sorun
```

### Alternatif: Git Değişikliklerinden Otomatik Hedef

```bash
# git diff analiz edilir, hedef otomatik çıkarılır
ctx build
```

### Önizleme (Kopyalamadan Önce)

```bash
# Context'in son halini görün
ctx preview
```

---

## Gelişmiş Özellikler

### RLM ile Derin Analiz

```bash
# Güvenlik açıklarını tara
ctx analyze "Bu projede potansiyel güvenlik açıklarını bul"

# Kod açıklaması al
ctx explain src/auth/service.ts

# Güvenli refaktör
ctx refactor "User sınıfını Account olarak yeniden adlandır" --dry-run
```

### Yapılandırma

ContextOS iki yapılandırma dosyası kullanır:

#### `.contextos/context.yaml` - Proje Tanımı

```yaml
version: "3.1"

project:
  name: "my-backend-api"
  language: "typescript"
  framework: "nestjs"

# Kodlama kuralları
constraints:
  - rule: "Controller'lar doğrudan veritabanına erişmemeli"
    severity: "error"
  - rule: "Async fonksiyonlarda try-catch zorunlu"
    severity: "warning"

# Modül sınırları
boundaries:
  - name: "core"
    paths: ["src/core/**"]
    allowed_imports: ["src/shared/**"]
```

#### `.contextos/config.yaml` - Araç Ayarları

```yaml
# İndeksleme ayarları
indexing:
  ignore_patterns:
    - "node_modules/**"
    - "**/*.test.ts"
    - "dist/**"

# Token bütçesi
budgeting:
  target_model: "gpt-4-turbo"
  max_tokens: 32000

# Bağımlılık grafiği
graph:
  max_depth: 2
```

---

## Örnek Senaryolar

### Senaryo 1: Yeni Özellik Ekleme

```bash
# Projenize authentication ekliyorsunuz
ctx goal "JWT tabanlı authentication sistemi ekle"
ctx copy

# Yapıştırın, sorun:
# "Bu context'e göre JWT authentication nasıl eklerim?"
```

### Senaryo 2: Bug Düzeltme

```bash
# Login'de bir bug var
ctx goal "Login endpoint 500 hatası veriyor, düzelt"
ctx copy

# Yapıştırın, sorun:
# "Bu hatanın sebebi ne olabilir?"
```

### Senaryo 3: Kod İnceleme

```bash
# Belirli bir dosyayı analiz edin
ctx explain src/payment/PaymentService.ts

# Çıktı: Dosyanın ne yaptığı, bağımlılıkları, potansiyel sorunlar
```

### Senaryo 4: Güvenli Refactoring

```bash
# Büyük bir yeniden adlandırma yapmadan önce
ctx refactor "UserRepository -> AccountRepository" --dry-run

# Hangi dosyaların etkileneceğini görün
# Sonra uygulayın veya iptal edin
```

---

## Sık Sorulan Sorular

### Model'i kim seçiyor, önemli dosyaları nasıl buluyor?

ContextOS **hibrit sıralama** algoritması kullanır:
- Semantik benzerlik (vector search)
- Bağımlılık grafiği (import takibi)
- Sizin kurallarınız (constraints)

Bu üçünün birleşimi, en alakalı dosyaları bulur.

### Token maliyetini nasıl azaltıyor?

- **Gereksiz dosyaları hariç tutar** (test, config, node_modules)
- **En yüksek skorlu dosyaları seçer**
- **Bütçeye göre kırpar**
- Sonuç: %50-70 token tasarrufu

### Hangi dilleri destekliyor?

- TypeScript / JavaScript
- Python
- Go
- Rust
- Java

Her dil için import analizi, fonksiyon ve sınıf çıkarma çalışır.

### API anahtarı zorunlu mu?

Hayır. API anahtarı olmadan temel özellikler çalışır:
- `ctx init`, `ctx index`, `ctx build`, `ctx goal`, `ctx copy`

API anahtarı (Gemini/OpenAI/Anthropic) şunlar için gerekli:
- `ctx analyze` (derin analiz)
- `ctx refactor` (akıllı refaktör)
- `ctx explain` (kod açıklama)
- `ctx suggest-rules` (kural önerisi)

---

## AI Araçlarıyla Entegrasyon (MCP)

ContextOS, **Model Context Protocol (MCP)** destekleyen AI araçlarıyla otomatik entegre olabilir. Bu sayede her seferinde yapıştırma yapmanıza gerek kalmaz!

### Desteklenen Araçlar

- ✅ Claude Desktop / Claude Code
- ✅ Cursor
- ✅ Windsurf
- ✅ MCP destekleyen diğer araçlar

### Kurulum: Claude Desktop

`claude_desktop_config.json` dosyanıza ekleyin:

```json
{
  "mcpServers": {
    "contextos": {
      "command": "npx",
      "args": ["@contextos/mcp"],
      "cwd": "/proje/klasörünüz"
    }
  }
}
```

### Kurulum: Cursor

Cursor ayarlarına ekleyin:

```json
{
  "mcp.servers": {
    "contextos": {
      "command": "npx @contextos/mcp",
      "cwd": "${workspaceFolder}"
    }
  }
}
```

### Nasıl Çalışır?

MCP kurulduktan sonra, AI aracı otomatik olarak şu yeteneklere sahip olur:

| Yetenek | Açıklama |
|---------|----------|
| `contextos_build` | Hedef için context oluştur |
| `contextos_analyze` | Derin analiz yap |
| `contextos_find` | Dosya ara |
| `contextos_deps` | Bağımlılıkları getir |
| `contextos_explain` | Dosya açıkla |

**Örnek Kullanım (Claude'da):**

```
Kullanıcı: "UserController'a rate limiting ekle"

Claude: (Otomatik olarak contextos_build çağırır)
        (İlgili dosyaları alır)
        (Tam context ile kod yazar)
```

Artık yapıştırma yok, her şey otomatik! 🚀

---

## Özet

```
┌─────────────────────────────────────────────────────────┐
│                     ContextOS                            │
│                                                         │
│  Problem: AI'a projeyi anlatmak zor ve pahalı           │
│  Çözüm:   Akıllı dosya seçimi + token optimizasyonu     │
│                                                         │
│  Kurulum: npm install -g @contextos/cli                 │
│           cd your-project                               │
│           ctx init                                      │
│           ctx index                                     │
│                                                         │
│  Kullanım: ctx goal "Hedefiniz" → ctx copy → Yapıştır   │
│                                                         │
│  Sonuç:   - %50-70 token tasarrufu                      │
│           - Daha doğru AI yanıtları                     │
│           - Zaman kazancı                               │
└─────────────────────────────────────────────────────────┘
```
