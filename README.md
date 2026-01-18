# ContextOS

<div align="center">

![ContextOS Logo](https://img.shields.io/badge/ContextOS-v2.0-blue?style=for-the-badge&logo=data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PHBhdGggZmlsbD0id2hpdGUiIGQ9Ik0xMiAyQzYuNDggMiAyIDYuNDggMiAxMnM0LjQ4IDEwIDEwIDEwIDEwLTQuNDggMTAtMTBTMTcuNTIgMiAxMiAyem0tMSAxNUg5di02aDJ2NnptMC04SDlWN2gydjJ6Ii8+PC9zdmc+)

**The Context Server Protocol for AI Coding**

[![npm version](https://img.shields.io/npm/v/@contextos/cli?style=flat-square)](https://www.npmjs.com/package/@contextos/cli)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.4-blue?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![Tests](https://img.shields.io/badge/Tests-194%20passing-green?style=flat-square)](https://github.com/ixayldz/ContextOS)

*"Stop paying for noise. Curate your context."*

[Hızlı Başlangıç](#-hızlı-başlangıç) • [Nasıl Çalışır](#-nasıl-çalışır) • [CLI Komutları](#-cli-komutları) • [MCP Entegrasyonu](#-mcp-entegrasyonu)

</div>

---

## 🤔 ContextOS Nedir?

ContextOS, yapay zeka kodlama asistanlarına (ChatGPT, Claude, Gemini, Cursor vb.) projenizi anlatırken **en önemli dosyaları otomatik olarak seçen** bir altyapıdır.

### Problem

Bir yapay zekaya kod yardımı için başvurduğunuzda şöyle bir ikilemle karşılaşırsınız:

| Yaklaşım | Problem |
|----------|---------|
| **Tüm projeyi yapıştır** | 💸 Token israfı, maliyet, gereksiz dosyalar modeli şaşırtır |
| **Dosyaları elle seç** | ⏰ Zaman kaybı, bağımlılıkları kaçırma riski |
| **Modelin tahmin etmesini bekle** | 🎯 Yanlış dosyalar, "halüsinasyon", eksik context |

### Çözüm

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
```

**Sonuç:** %50-70 token tasarrufu + daha doğru AI yanıtları

---

## ✨ Özellikler

<table>
<tr>
<td width="50%">

### 🧠 RLM Engine
MIT CSAIL'ın Recursive Language Model araştırmasına dayanır. Context'i "veri" değil, "keşfedilebilir ortam" olarak ele alır.

</td>
<td width="50%">

### 🔗 6 Dil Desteği
- TypeScript / JavaScript
- Python
- Go
- Rust
- Java

</td>
</tr>
<tr>
<td width="50%">

### 📊 Hibrit Sıralama
- **%40 Semantik** - Vector benzerliği
- **%40 Bağımlılık** - Import grafiği
- **%20 Kurallar** - Sizin kısıtlarınız

</td>
<td width="50%">

### 🤖 Çoklu Model Desteği
- Gemini 3 Pro (2M context)
- GPT-5.2 / GPT-4
- Claude 4.5 Opus
- Yerel modeller (Ollama)

</td>
</tr>
<tr>
<td width="50%">

### 🔌 Plugin System
Extensible architecture with marketplace:
- `ctx plugin install/remove`
- Custom hooks & commands
- Local + remote registry

</td>
<td width="50%">

### 🖥️ IDE Entegrasyonları
- VS Code Extension
- JetBrains (IntelliJ, WebStorm)
- Neovim (Lua + Telescope)

</td>
</tr>
<tr>
<td width="50%">

### 🏢 Enterprise Deployment
- Docker & Kubernetes ready
- Helm charts included
- SSO/LDAP support

</td>
<td width="50%">

### 🎯 Model Fine-tuning
- Training data collection
- JSONL/OpenAI/Anthropic export
- `ctx finetune export/validate`

</td>
</tr>
</table>

---

## 🎯 Universal Setup (TEK KOMUT!)

Tüm AI araçlarınızı tek komutla ContextOS ile entegre edin:

```bash
npx @contextos/setup
```

### Desteklenen Araçlar

| Araç | Tip | MCP Desteği |
|------|-----|-------------|
| **Claude Desktop** | IDE | ✅ Native |
| **Claude Code CLI** | CLI | ✅ Native |
| **Cursor** | IDE | ✅ Native |
| **Windsurf** | IDE | ✅ Native |
| **VS Code** | IDE | 🔌 Extension |
| **Kilo Code** | IDE | ✅ Native |
| **Codex CLI** | CLI | 📦 Wrapper |
| **Gemini CLI** | CLI | 📦 Wrapper |
| **OpenCode CLI** | CLI | 📦 Wrapper |
| **Warp Terminal** | Terminal | 📦 Wrapper |

```bash
# Örnek çıktı:
# 🚀 ContextOS Universal Setup
#
# Found 6 AI tool(s)
#
# 🖥️  IDEs:
#    Claude Desktop MCP
#    Cursor MCP
#    Windsurf MCP
#
# ⌨️  CLI Tools:
#    Claude Code CLI MCP
#    Codex CLI Wrapper
#
# ✅ Setup complete: 5/5 tools configured
```

---

## 🚀 Hızlı Başlangıç

### Kurulum

```bash
# Global olarak CLI'ı kurun
npm install -g @contextos/cli

# Proje klasörünüze gidin
cd your-project

# ContextOS'u başlatın
ctx init

# Projenizi indeksleyin
ctx index
```

### Temel Kullanım

```bash
# Hedef belirtip context oluştur
ctx goal "Kullanıcı doğrulama sistemine 2FA ekle"

# Context'i panoya kopyala
ctx copy

# Yapay zeka asistanınıza yapıştırın!
```

### AI API Anahtarı (Opsiyonel)

```bash
# Gelişmiş özellikler için (analyze, refactor, explain)
export GEMINI_API_KEY="your-key-here"
# veya
export OPENAI_API_KEY="your-key-here"
# veya
export ANTHROPIC_API_KEY="your-key-here"
```

---

## 🔧 Nasıl Çalışır?

### Hibrit Sıralama Algoritması

ContextOS, hangi dosyaların önemli olduğuna karar verirken **üç farklı sinyal** kullanır:

```
"AuthController'a rate limiting ekle"
                    │
                    ▼
┌─────────────────────────────────────────────────────┐
│                  Hibrit Sıralama                    │
│                                                     │
│  AuthController.ts                                  │
│    Semantik:   0.95 × 0.4 = 0.38                   │
│    Bağımlılık: 1.00 × 0.4 = 0.40 (doğrudan hedef)  │
│    Kurallar:   0.80 × 0.2 = 0.16                   │
│    ─────────────────────────                        │
│    TOPLAM: 0.94 ⭐ → DAHİL                         │
│                                                     │
│  logger.ts                                          │
│    Semantik:   0.10 × 0.4 = 0.04                   │
│    Bağımlılık: 0.20 × 0.4 = 0.08 (3 adım uzakta)   │
│    Kurallar:   0.00 × 0.2 = 0.00                   │
│    ─────────────────────────                        │
│    TOPLAM: 0.12 ❌ → HARİÇ                         │
└─────────────────────────────────────────────────────┘
```

### RLM (Recursive Language Model) Engine

Geleneksel yaklaşım:
```
LLM(dosyalar + soru) → cevap
```

ContextOS RLM yaklaşımı:
```
LLM(soru) → kod yaz → çalıştır → gözlemle → tekrarla
```

Model, projenizi "keşfetmek" için kod yazabilir:

```javascript
// Model bunu yazar
const authFiles = ctx.find('**/auth/**/*.ts');
const deps = ctx.getDependencies('AuthService');

// ContextOS sandbox'ta çalıştırır
// Model sonucu görür ve context oluşturur
```

---

## 📋 CLI Komutları

### Temel Komutlar

| Komut | Açıklama |
|-------|----------|
| `ctx init` | ContextOS'u başlat |
| `ctx index` | Projeyi indeksle |
| `ctx goal "..."` | Hedef için context oluştur |
| `ctx build` | Git diff'ten otomatik hedef çıkar |
| `ctx preview` | Context'i önizle |
| `ctx copy` | Panoya kopyala |

### AI-Powered Komutlar

| Komut | Açıklama |
|-------|----------|
| `ctx analyze "..."` | RLM ile derin analiz |
| `ctx refactor "..."` | Güvenli refaktör |
| `ctx explain <file>` | Dosya açıklaması |
| `ctx trace <symbol>` | Fonksiyon takibi |
| `ctx doctor` | Konfigürasyon kontrolü |
| `ctx suggest-rules` | Kural önerisi |

### Plugin & Fine-tuning Komutları

| Komut | Açıklama |
|-------|----------|
| `ctx plugin list` | Yüklü pluginleri listele |
| `ctx plugin install <src>` | Plugin yükle |
| `ctx plugin create <name>` | Yeni plugin oluştur |
| `ctx finetune export` | Training data export |
| `ctx finetune validate` | Dataset doğrula |
| `ctx finetune stats` | İstatistikleri göster |

### 🤖 AI Code Generation

| Komut | Açıklama |
|-------|----------|
| `ctx generate "<prompt>"` | AI ile kod oluştur |
| `ctx generate --dry-run` | Önizleme (dosya yazmaz) |
| `ctx fix "<prompt>"` | AI ile bug düzelt |
| `ctx fix --file <path>` | Belirli dosyayı düzelt |

### Örnek Senaryolar

```bash
# 🤖 AI ile kod oluştur (YENİ!)
ctx generate "PRD'ye göre Express REST API oluştur"
ctx generate "Login ve register sayfaları oluştur"

# 🔧 AI ile bug düzelt (YENİ!)
ctx fix "Authentication 401 hatası veriyor"

# Context oluştur + AI'a yapıştır
ctx goal "JWT tabanlı authentication sistemi ekle"
ctx copy

# Kod inceleme
ctx explain src/payment/PaymentService.ts

# Güvenli refaktör
ctx refactor "UserRepository -> AccountRepository" --dry-run
```

---

## 🔌 MCP Entegrasyonu

ContextOS, **Model Context Protocol (MCP)** destekleyen AI araçlarıyla otomatik entegre olur. Artık yapıştırmaya gerek yok!

### Desteklenen Araçlar

- ✅ Claude Desktop / Claude Code
- ✅ Cursor
- ✅ Windsurf
- ✅ Tüm MCP uyumlu araçlar

### Claude Desktop Kurulumu

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

### Cursor Kurulumu

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

### MCP Özellikleri

| Özellik | Açıklama |
|---------|----------|
| `contextos_build` | Hedef için context oluştur |
| `contextos_analyze` | RLM ile derin analiz |
| `contextos_find` | Dosya ara |
| `contextos_deps` | Bağımlılıkları getir |
| `contextos_explain` | Dosya açıkla |

**Artık:**
```
Kullanıcı: "UserController'a rate limiting ekle"

AI: (Otomatik contextos_build çağırır)
    (İlgili dosyaları alır)
    (Tam context ile kod yazar)
```

---

## ⚙️ Konfigürasyon

### `.contextos/context.yaml`

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

### `.contextos/config.yaml`

```yaml
# İndeksleme
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

## 🏗️ Mimari

```
┌─────────────────────────────────────────────────────────────┐
│                      ctx CLI (13 komut)                      │
│  init | index | build | goal | analyze | refactor | explain │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                     @contextos/core                          │
├─────────────────────────────────────────────────────────────┤
│  RLM Engine   │ Proposal    │ Blackboard   │ Scope         │
│  Sandbox      │ Manager     │ (Paylaşımlı) │ Manager       │
│  Watchdog     │ (Transaction)│             │ (Anti-index)  │
├─────────────────────────────────────────────────────────────┤
│  Model        │ Ranker      │ Budgeter     │ Parser        │
│  Adapters     │ (Hibrit)    │ (Token)      │ (6 dil)       │
├─────────────────────────────────────────────────────────────┤
│  Logger       │ Errors      │ Config       │ Graph         │
│  (Yapısal)    │ (Aksiyonel) │ (Zod/YAML)   │ (Bağımlılık)  │
└─────────────────────────────────────────────────────────────┘
```

---

## 📁 Proje Yapısı

```
ContextOS/
├── packages/
│   ├── core/           # 174 KB - Ana motor
│   │   ├── src/
│   │   │   ├── rlm/    # RLM Engine
│   │   │   ├── llm/    # Model Adapters
│   │   │   ├── parser/ # 6 dil desteği
│   │   │   └── ...
│   │   └── test/       # 180 test
│   │
│   ├── cli/            # 56 KB - 13 komut
│   ├── sdk/            # SDK
│   └── mcp/            # MCP Server
│
├── docs/               # VitePress dokümantasyon
├── USAGE.md            # Türkçe kullanım kılavuzu
└── README.md
│   ├── jetbrains/      # JetBrains IDE Plugin (Kotlin)
│   └── neovim/         # Neovim Plugin (Lua)
```

---

## 🧪 Geliştirme

```bash
# Klonla
git clone https://github.com/ixayldz/ContextOS.git
cd ContextOS

# Bağımlılıkları kur
pnpm install

# Build
pnpm build

# Test
pnpm test  # 180 test

# Development
pnpm dev
```

---

## 📊 Metrikler

| Metrik | Değer |
|--------|-------|
| Tests | 194 ✅ |
| CLI Commands | 15 |
| Languages | 6 |
| Model Adapters | 3 |
| IDE Plugins | 3 (VS Code, JetBrains, Neovim) |
| Core Size | 174 KB |

---

## 🤝 Katkıda Bulunma

1. Fork yapın
2. Feature branch oluşturun (`git checkout -b feature/amazing-feature`)
3. Commit yapın (`git commit -m 'Add amazing feature'`)
4. Push yapın (`git push origin feature/amazing-feature`)
5. Pull Request açın

---

## 📄 Lisans

MIT © ContextOS Team

---

<div align="center">

**Built with ❤️ for developers who care about context**

[⬆ Yukarı](#contextos)

</div>
