---
layout: home

hero:
  name: ContextOS
  text: The Context Server Protocol for AI Coding
  tagline: Stop paying for noise. Curate your context.
  image:
    src: /logo.svg
    alt: ContextOS
  actions:
    - theme: brand
      text: Get Started
      link: /guide/getting-started
    - theme: alt
      text: View on GitHub
      link: https://github.com/contextos/contextos

features:
  - icon: 🧠
    title: RLM Engine
    details: Recursive Language Model engine based on MIT CSAIL research. Context as an external, queryable environment.
  - icon: 🔗
    title: Dependency Graph
    details: Automatic dependency analysis across 6 languages - TypeScript, JavaScript, Python, Go, Rust, Java.
  - icon: 📊
    title: Hybrid Ranking
    details: Combines semantic similarity, graph distance, and custom rules for optimal context selection.
  - icon: 🤖
    title: Multi-Model Support
    details: Works with Gemini 3, GPT-5, Claude 4.5 and more. Unified adapter interface.
  - icon: 🔒
    title: Safe Refactoring
    details: Transaction layer with conflict detection. Proposals instead of direct writes.
  - icon: ⚡
    title: Token Optimization
    details: Reduce token usage by 50-70% while maintaining context quality.
---

## Quick Start

```bash
# Install globally
npm install -g @contextos/cli

# Initialize your project
cd your-project
ctx init

# Build context for your goal
ctx goal "Add authentication to API"

# Copy optimized context
ctx copy
```

## Why ContextOS?

| Traditional Approach | ContextOS |
|---------------------|-----------|
| 💸 Paste entire codebase → Token waste | 📊 Hybrid ranking → Optimal selection |
| ⏰ Manual file selection → Time consuming | 🤖 AI-powered → Automatic |
| 🎯 Let AI guess → Wrong context | 🔗 Dependency graph → Complete context |

## Powered by Research

ContextOS implements the **Recursive Language Model (RLM)** paradigm from MIT CSAIL:

> "Instead of treating context as static input, RLM treats it as an external environment that can be queried programmatically."

[Read the RLM Paper →](/rlm/how-it-works)
