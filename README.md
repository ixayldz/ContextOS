# ContextOS

<div align="center">

![ContextOS Logo](https://img.shields.io/badge/ContextOS-v0.1.0-blue?style=for-the-badge&logo=data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PHBhdGggZmlsbD0id2hpdGUiIGQ9Ik0xMiAyQzYuNDggMiAyIDYuNDggMiAxMnM0LjQ4IDEwIDEwIDEwIDEwLTQuNDggMTAtMTBTMTcuNTIgMiAxMiAyem0tMSAxNUg5di02aDJ2NnptMC04SDlWN2gydjJ6Ii8+PC9zdmc+)

**The Context Server Protocol for AI Coding**

[![npm version](https://img.shields.io/npm/v/@contextos/cli?style=flat-square)](https://www.npmjs.com/package/@contextos/cli)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.4-blue?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![Gemini 3](https://img.shields.io/badge/Gemini-3.0_Pro-4285F4?style=flat-square&logo=google)](https://ai.google.dev/gemini-api)

*"Stop paying for noise. Curate your context."*

[Quick Start](#-quick-start) • [Features](#-key-features) • [Commands](#-cli-commands) • [Configuration](#%EF%B8%8F-configuration) • [API](#-gemini-30-pro-integration)

</div>

---

## 🤔 What Problem Does ContextOS Solve?

When working with AI coding assistants (GPT-4, Claude, Gemini), you face a dilemma:

| Approach | Problem |
|----------|---------|
| **Paste entire codebase** | 💸 Token waste, context pollution, high cost |
| **Manually select files** | ⏰ Time consuming, easy to miss dependencies |
| **Let AI guess** | 🎯 Often gets wrong context, hallucinations |

**ContextOS solves this** by automatically building the optimal context for your specific task using:
- 🧠 **Semantic understanding** - Knows what code is relevant to your goal
- 🔗 **Dependency analysis** - Includes related files automatically
- 📏 **Token budgeting** - Fits exactly in your model's context window
- 🤖 **AI-powered inference** - Uses Gemini 3 Pro to understand your intent

---

## ✨ Key Features

<table>
<tr>
<td width="50%">

### 🎯 Hybrid Ranking Algorithm
Combines three signals for optimal file selection:
- **40% Semantic** - Vector similarity to your goal
- **40% Structural** - Dependency graph distance
- **20% Rules** - Your custom constraints

</td>
<td width="50%">

### 📊 Token Optimization
Intelligent budgeting that:
- Reduces token usage by **50-70%**
- Adapts to model context limits
- Prioritizes high-value content

</td>
</tr>
<tr>
<td width="50%">

### 🤖 Gemini 3 Pro Integration
AI-powered features:
- Smart goal inference from git diff
- Automatic constraint suggestions
- Human-readable error explanations

</td>
<td width="50%">

### 🔓 Vendor Agnostic
Works with any LLM:
- GPT-4 / GPT-4 Turbo
- Claude 3 Opus / Sonnet
- Gemini Pro / Flash
- Local models (Ollama, etc.)

</td>
</tr>
</table>

---

## 🚀 Quick Start

### Installation

```bash
# Install globally
npm install -g @contextos/cli

# Or use with npx
npx @contextos/cli init
```

### Initialize Your Project

```bash
# Navigate to your project
cd your-project

# Initialize ContextOS (auto-detects project type)
ctx init
```

This creates the `.contextos/` folder with:
```
.contextos/
├── context.yaml      # Project configuration
├── config.yaml       # Tool settings
├── db/               # Vector store & dependency graph
└── rules/
    └── coding.md     # Coding guidelines
```

### Build Your First Context

```bash
# Index your codebase (one-time, then incremental)
ctx index

# Build context with explicit goal
ctx goal "Add rate limiting to AuthController"

# Or auto-infer goal from git changes
ctx build

# Copy to clipboard
ctx copy
```

### Use with AI Assistants

1. Run `ctx copy` to copy context to clipboard
2. Paste into ChatGPT, Claude, or your AI assistant
3. Ask your question with perfect context!

---

## 📋 CLI Commands

### Core Commands

| Command | Description | Example |
|---------|-------------|---------|
| `ctx init` | Initialize ContextOS in project | `ctx init` |
| `ctx init -y` | Skip prompts, use defaults | `ctx init -y` |
| `ctx index` | Build/update project index | `ctx index` |
| `ctx index --full` | Force full re-index | `ctx index --full` |

### Context Building

| Command | Description | Example |
|---------|-------------|---------|
| `ctx goal "..."` | Build context for specific goal | `ctx goal "Fix login bug"` |
| `ctx goal "..." -c` | Build and copy to clipboard | `ctx goal "Add auth" -c` |
| `ctx build` | Auto-infer goal from git diff | `ctx build` |
| `ctx preview` | Preview context without copying | `ctx preview` |
| `ctx copy` | Copy last context to clipboard | `ctx copy` |

### Analysis & Configuration

| Command | Description | Example |
|---------|-------------|---------|
| `ctx doctor` | Check for configuration drift | `ctx doctor` |
| `ctx doctor --explain` | AI-powered error explanations | `ctx doctor --explain` |
| `ctx doctor --ci` | CI mode (exit 1 on errors) | `ctx doctor --ci` |
| `ctx config` | View all configuration | `ctx config` |
| `ctx config --edit` | Interactive config editor | `ctx config --edit` |
| `ctx config <key>` | Get specific config value | `ctx config embedding.model` |
| `ctx config <key> <value>` | Set config value | `ctx config graph.max_depth 3` |

### AI-Powered Features (Requires `GEMINI_API_KEY`)

| Command | Description | Example |
|---------|-------------|---------|
| `ctx suggest-rules` | AI suggests coding constraints | `ctx suggest-rules` |
| `ctx suggest-rules --apply` | Auto-apply suggestions | `ctx suggest-rules --apply` |
| `ctx analyze "..."` | RLM-powered deep analysis | `ctx analyze "Find vulnerabilities"` |
| `ctx refactor "..."` | Safe refactoring with impact analysis | `ctx refactor "Rename User to Account"` |
| `ctx explain <file>` | AI-powered code explanation | `ctx explain src/auth.ts` |
| `ctx trace <symbol>` | Trace function call chains | `ctx trace authenticate` |

---

## ⚙️ Configuration

### context.yaml - Project Definition

```yaml
version: "3.1"

project:
  name: "my-backend-api"
  language: "typescript"
  framework: "nestjs"
  description: "REST API for e-commerce platform"

# Technology stack (helps AI understand context)
stack:
  database: "postgresql"
  cache: "redis"
  queue: "bullmq"
  auth: "jwt"

# Coding rules (enforced in context)
constraints:
  # Error: Will be strongly emphasized
  - rule: "Never use console.log in production code"
    severity: "error"
  
  # Warning: Gentle reminder
  - rule: "Prefer composition over inheritance"
    severity: "warning"
  
  # Scoped rules (apply to specific paths)
  - rule: "Controllers must not access database directly"
    severity: "error"
    scope: "src/controllers/**"

# Module boundaries (prevents context pollution)
boundaries:
  - name: "core"
    paths: ["src/core/**"]
    allowed_imports: ["src/shared/**"]
  
  - name: "features"
    paths: ["src/features/**"]
    allowed_imports: ["src/core/**", "src/shared/**"]

# Metadata (auto-updated by ctx index)
meta:
  last_indexed: "2024-01-15T10:30:00Z"
  index_version: "3.1"
```

### config.yaml - Tool Settings

```yaml
# Indexing settings
indexing:
  watch_mode: true          # Auto-index on file changes
  ignore_patterns:
    - "**/*.test.ts"
    - "**/*.spec.ts"
    - "node_modules/**"
    - "dist/**"
    - ".git/**"
    - "coverage/**"
  file_size_limit: "1MB"    # Skip large files

# Dependency graph settings
graph:
  max_depth: 2              # How deep to follow imports
  follow_types:
    - "import"
    - "require"
    - "export"
  include_types: true       # Include type imports

# Embedding settings
embedding:
  strategy: "adaptive"      # adaptive | full | lazy
  provider: "local"         # local | openai
  model: "all-MiniLM-L6-v2" # Local embedding model
  chunk_size: 512           # Tokens per chunk
  overlap: 50               # Overlap between chunks

# Token budgeting
budgeting:
  strategy: "adaptive"      # adaptive | fixed
  target_model: "gpt-4-turbo"  # Target LLM for budget calculation
  max_tokens: 32000         # Override model default
```

---

## 🤖 Gemini 3.0 Pro Integration

ContextOS uses **Gemini 3 Pro** for intelligent features. Set your API key:

```bash
# Set API key (get from https://makersuite.google.com/app/apikey)
export GEMINI_API_KEY="AIzaSy..."

# Optional: Override model (default: gemini-3-pro-preview)
export GEMINI_MODEL="gemini-3-flash-preview"
```

### Features Powered by Gemini 3

#### 1. Smart Goal Inference
```bash
# Make some code changes, then:
ctx build

# Gemini analyzes your git diff and infers:
# "Implementing JWT refresh token rotation for enhanced security"
```

#### 2. Constraint Suggestions
```bash
# Analyze your codebase and get AI-suggested rules:
ctx suggest-rules

# Output:
# 📋 Suggested Constraints:
# 
# 1. 🚫 Use repository pattern for database access
#    Severity: error
#    Reason: Controllers directly access database...
#
# 2. ⚠️ Add error handling to async functions
#    Severity: warning
#    Reason: Multiple unhandled promise rejections...
```

#### 3. Error Explanations
```bash
ctx doctor --explain

# Instead of cryptic errors, get:
# 🤖 AI Explanation:
# Your context.yaml declares PostgreSQL as the database,
# but package.json doesn't include 'pg' or 'typeorm'.
# This could mean you're using a different database
# or forgot to install the dependency...
```

### Gemini 3 Thinking Levels

Gemini 3 uses "thinking levels" for reasoning depth:

| Level | Use Case | Speed |
|-------|----------|-------|
| `low` | Simple tasks, chat | ⚡ Fast |
| `medium` | Balanced reasoning | ⚖️ Medium |
| `high` | Complex analysis (default) | 🧠 Thorough |

> **Note:** ContextOS defaults to `high` for best code understanding.

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         ctx CLI                              │
│  init | index | build | goal | analyze | refactor | explain  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      @contextos/core                         │
│                                                              │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐    │
│  │  Config  │  │  Parser  │  │  Graph   │  │ Embedder │    │
│  │   Zod    │  │TreeSitter│  │   BFS    │  │  SQLite  │    │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘    │
│                                                              │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐    │
│  │  RLM     │  │ Proposal │  │Blackboard│  │  Scope   │    │
│  │  Engine  │  │  Manager │  │  State   │  │  Manager │    │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘    │
│                                                              │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐    │
│  │  Ranker  │  │ Budgeter │  │ Builder  │  │  Gemini  │    │
│  │  Hybrid  │  │  Token   │  │ Context  │  │   3 Pro  │    │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘    │
└─────────────────────────────────────────────────────────────┘
```

### How Ranking Works

```
Goal: "Add authentication to UserController"
                    │
                    ▼
┌─────────────────────────────────────────────────────────────┐
│                     Hybrid Ranker                            │
│                                                              │
│  src/auth/AuthService.ts                                     │
│    Vector: 0.88 × 0.4 = 0.35                                │
│    Graph:  1.00 × 0.4 = 0.40  (directly imported)           │
│    Rules:  0.50 × 0.2 = 0.10  (matches "auth" rule)         │
│    ────────────────────────                                  │
│    Final Score: 0.85 ⭐                                      │
│                                                              │
│  src/utils/logger.ts                                         │
│    Vector: 0.15 × 0.4 = 0.06                                │
│    Graph:  0.30 × 0.4 = 0.12  (3 hops away)                 │
│    Rules:  0.00 × 0.2 = 0.00                                │
│    ────────────────────────                                  │
│    Final Score: 0.18 ❌ (excluded)                           │
└─────────────────────────────────────────────────────────────┘
```

---

## 📁 Project Structure

```
contextos/
├── packages/
│   ├── core/                 # Core engine (154 KB)
│   │   ├── src/
│   │   │   ├── config/       # YAML schema & loader
│   │   │   ├── parser/       # Tree-sitter AST parsing
│   │   │   ├── graph/        # Dependency graph
│   │   │   ├── embedding/    # Vector store & chunker
│   │   │   ├── ranking/      # Hybrid ranking algorithm
│   │   │   ├── budgeting/    # Token budget manager
│   │   │   ├── context/      # Context builder
│   │   │   ├── doctor/       # Drift detection
│   │   │   ├── llm/          # Model adapters (Gemini, OpenAI, Anthropic)
│   │   │   └── rlm/          # RLM Engine (NEW)
│   │   │       ├── engine.ts     # Recursive execution
│   │   │       ├── sandbox.ts    # Safe code execution
│   │   │       ├── proposal.ts   # Transaction layer
│   │   │       ├── blackboard.ts # Shared state
│   │   │       └── scope.ts      # Anti-indexing
│   │   └── test/             # 143 tests
│   │
│   ├── cli/                  # CLI interface (56 KB)
│   │   └── src/
│   │       └── commands/     # 13 CLI commands
│   │
│   └── sdk/                  # SDK for integrations
│
└── README.md
```

---

## 🧪 Development

### Prerequisites

- Node.js 18+
- pnpm 8+

### Setup

```bash
# Clone the repository
git clone https://github.com/yourusername/contextos.git
cd contextos

# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run tests
pnpm test

# Development mode (watch)
pnpm dev
```

### Running Locally

```bash
# After building, you can run the CLI directly:
node packages/cli/dist/index.js init

# Or link globally:
cd packages/cli
npm link
ctx --help
```

---

## 🔧 Troubleshooting

### Common Issues

<details>
<summary><b>ctx: command not found</b></summary>

Make sure the package is installed globally:
```bash
npm install -g @contextos/cli
```

Or use with npx:
```bash
npx @contextos/cli init
```
</details>

<details>
<summary><b>Gemini API errors</b></summary>

1. Check your API key is set:
   ```bash
   echo $GEMINI_API_KEY
   ```

2. Verify the key is valid at [Google AI Studio](https://makersuite.google.com/)

3. Check rate limits (free tier: 60 requests/minute)
</details>

<details>
<summary><b>Index takes too long</b></summary>

1. Check for large files:
   ```bash
   ctx config indexing.file_size_limit "500KB"
   ```

2. Add more ignore patterns:
   ```yaml
   # config.yaml
   indexing:
     ignore_patterns:
       - "**/*.min.js"
       - "**/vendor/**"
   ```
</details>

<details>
<summary><b>Context doesn't include expected files</b></summary>

1. Check if file is indexed:
   ```bash
   ctx index --full
   ```

2. Increase graph depth:
   ```bash
   ctx config graph.max_depth 3
   ```

3. Check ignore patterns aren't excluding it
</details>

---

## 🗺️ Roadmap

- [x] **Phase 1**: Core CLI & Protocol
  - [x] Config schema & parser
  - [x] AST parsing (Tree-sitter)
  - [x] Dependency graph
  - [x] Vector embeddings
  - [x] Hybrid ranking
  - [x] Token budgeting
  - [x] CLI commands
  - [x] Gemini 3 integration

- [x] **Phase 2**: IDE Integration
  - [x] VS Code extension (scaffold)
  - [x] Sidebar views
  - [x] IntelliSense for context.yaml (JSON Schema)
  - [x] Continue.dev provider
  - [x] SDK package for tool builders

- [x] **Phase 3**: Team & Enterprise
  - [x] Git-based team sync
  - [x] Cloud sync with E2EE (AES-256-GCM)
  - [x] Analytics dashboard
  - [x] RBAC system
  - [x] Audit logging (SOC2 ready)

---

## 🤝 Contributing

Contributions are welcome! Please read our [Contributing Guide](CONTRIBUTING.md) first.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📄 License

MIT © ContextOS Team

---

<div align="center">

**Built with ❤️ for developers who care about context**

[⬆ Back to Top](#contextos)

</div>
