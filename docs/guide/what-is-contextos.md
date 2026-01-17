# What is ContextOS?

ContextOS is **The Context Server Protocol for AI Coding** - an infrastructure layer that optimizes how AI coding assistants receive context from your codebase.

## The Problem

When working with AI coding assistants (GPT-4, Claude, Gemini), you face a dilemma:

| Approach | Problem |
|----------|---------|
| **Paste entire codebase** | 💸 Token waste, context pollution, high cost |
| **Manually select files** | ⏰ Time consuming, easy to miss dependencies |
| **Let AI guess** | 🎯 Often gets wrong context, hallucinations |

## The Solution

ContextOS solves this by automatically building the **optimal context** for your specific task:

```
Your Goal: "Add authentication to UserController"
                    │
                    ▼
    ┌─────────────────────────────────┐
    │         ContextOS Engine        │
    │                                 │
    │  1. Semantic Search (40%)       │
    │  2. Dependency Graph (40%)      │
    │  3. Custom Rules (20%)          │
    └─────────────────────────────────┘
                    │
                    ▼
    Optimized Context (50-70% fewer tokens)
```

## Key Features

### 🧠 RLM Engine
Based on MIT CSAIL's Recursive Language Model research. Treats context as an external, queryable environment.

### 🔗 Multi-Language Support
Full AST parsing for 6 languages:
- TypeScript / JavaScript
- Python
- Go
- Rust
- Java

### 📊 Hybrid Ranking
Combines three signals for optimal file selection:
- **Semantic similarity** - Vector search finds related code
- **Graph distance** - Dependencies matter
- **Custom rules** - Your constraints are respected

### 🤖 Model Agnostic
Works with any LLM through unified adapters:
- Gemini 3 Pro (recommended)
- GPT-5.2, GPT-4
- Claude 4.5 Opus
- Local models (Ollama)

## Architecture

```
┌─────────────────────────────────────────┐
│              ctx CLI (13 commands)       │
└─────────────────────────────────────────┘
                    │
┌─────────────────────────────────────────┐
│           @contextos/core                │
├─────────────────────────────────────────┤
│  RLM Engine │ Parsers │ Model Adapters  │
│  Proposal   │ Graph   │ Ranker          │
│  Blackboard │ Budget  │ Context Builder │
└─────────────────────────────────────────┘
```

## Not a Replacement

ContextOS is **not** a replacement for Cursor, Windsurf, or other AI IDEs. It's the **infrastructure layer** that powers them - like Kubernetes for AI coding context.

## Next Steps

- [Getting Started](/guide/getting-started) - Install and set up
- [Core Concepts](/guide/concepts) - Deep dive into how it works
