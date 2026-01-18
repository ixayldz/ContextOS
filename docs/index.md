# ContextOS Documentation

<div class="hero">
  <h1>ContextOS</h1>
  <p class="tagline">The Context Server Protocol for AI Coding</p>
  <p class="description">Stop paying for noise. Curate your context.</p>
  <div class="actions">
    <a href="/guide/getting-started" class="primary">Get Started →</a>
    <a href="https://github.com/ixayldz/ContextOS" class="secondary">GitHub</a>
  </div>
</div>

## Why ContextOS?

When asking AI for coding help, you face a dilemma:

| Approach | Problem |
|----------|---------|
| **Paste entire project** | 💸 Token waste, cost, irrelevant files confuse the model |
| **Manually select files** | ⏰ Time consuming, risk missing dependencies |
| **Let model guess** | 🎯 Wrong files, hallucinations, missing context |

**ContextOS solves this** by automatically selecting the most relevant files based on your goal.

## Features

<div class="features">
  <div class="feature">
    <h3>🧠 RLM Engine</h3>
    <p>Based on MIT CSAIL's Recursive Language Model research. Treats context as an explorable environment, not just data.</p>
  </div>
  <div class="feature">
    <h3>📊 Hybrid Ranking</h3>
    <p>40% Semantic + 40% Dependency + 20% Rules = Optimal file selection.</p>
  </div>
  <div class="feature">
    <h3>🔗 6 Language Support</h3>
    <p>TypeScript, JavaScript, Python, Go, Rust, Java - with full import graph analysis.</p>
  </div>
  <div class="feature">
    <h3>🎯 Universal Setup</h3>
    <p>One command to configure all AI tools: Claude, Cursor, Codex, Gemini, and more.</p>
  </div>
</div>

## Quick Start

```bash
# Setup all your AI tools
npx @contextos/setup

# Initialize in your project
cd your-project
npx @contextos/cli init

# Build context for a goal
npx @contextos/cli goal "Add rate limiting to AuthController"
```

## Supported Tools

| Tool | Type | Integration |
|------|------|-------------|
| Claude Desktop | IDE | ✅ Native MCP |
| Claude Code CLI | CLI | ✅ Native MCP |
| Cursor | IDE | ✅ Native MCP |
| Windsurf | IDE | ✅ Native MCP |
| VS Code | IDE | 🔌 Extension |
| Codex CLI | CLI | 📦 Wrapper |
| Gemini CLI | CLI | 📦 Wrapper |

## How It Works

```
You: "Add rate limiting to AuthController"
         │
         ▼
┌─────────────────────────────────────────┐
│         ContextOS Engine                │
│                                         │
│  1. Analyzes your goal semantically     │
│  2. Finds relevant files INTELLIGENTLY  │
│  3. Optimizes for token budget          │
│  4. Creates clean context package       │
└─────────────────────────────────────────┘
         │
         ▼
📄 Optimized context (only what's needed)
   - AuthController.ts
   - RateLimitMiddleware.ts  
   - AuthService.ts
```

**Result:** 50-70% token savings + more accurate AI responses

<style>
.hero {
  text-align: center;
  padding: 4rem 0;
}

.hero h1 {
  font-size: 3rem;
  font-weight: 700;
  background: linear-gradient(120deg, #3b82f6, #8b5cf6);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.tagline {
  font-size: 1.5rem;
  color: var(--vp-c-text-2);
}

.description {
  font-size: 1.1rem;
  color: var(--vp-c-text-3);
  font-style: italic;
}

.actions {
  margin-top: 2rem;
  display: flex;
  gap: 1rem;
  justify-content: center;
}

.actions a {
  padding: 0.75rem 1.5rem;
  border-radius: 8px;
  font-weight: 500;
  text-decoration: none;
}

.actions .primary {
  background: linear-gradient(120deg, #3b82f6, #8b5cf6);
  color: white;
}

.actions .secondary {
  border: 1px solid var(--vp-c-divider);
  color: var(--vp-c-text-1);
}

.features {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1.5rem;
  margin: 2rem 0;
}

.feature {
  padding: 1.5rem;
  border: 1px solid var(--vp-c-divider);
  border-radius: 12px;
}

.feature h3 {
  margin-top: 0;
}
</style>
