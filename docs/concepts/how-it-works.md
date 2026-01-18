# How It Works

ContextOS uses a sophisticated multi-signal ranking system to determine which files are most relevant to your goal.

## The Problem

When you ask an AI about your code, it needs context. But which files?

```
Your Codebase: 500+ files
AI Context Window: ~100,000 tokens
Your Goal: "Add rate limiting to AuthController"
```

**Challenge:** Select the 5-10 most relevant files from 500+.

## The Solution: Hybrid Ranking

ContextOS combines three ranking signals:

```
┌─────────────────────────────────────────────────────────────┐
│                    HYBRID RANKING                           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   Goal: "Add rate limiting to AuthController"               │
│                                                             │
│   ┌──────────────────────────────────────────────────────┐  │
│   │           SEMANTIC SIMILARITY (40%)                  │  │
│   │                                                      │  │
│   │   "AuthController" → AuthController.ts    0.95      │  │
│   │   "rate limiting" → RateLimiter.ts        0.88      │  │
│   │   "rate limiting" → Throttle.ts           0.72      │  │
│   └──────────────────────────────────────────────────────┘  │
│                                                             │
│   ┌──────────────────────────────────────────────────────┐  │
│   │           DEPENDENCY GRAPH (40%)                     │  │
│   │                                                      │  │
│   │   AuthController.ts                                  │  │
│   │     ├── imports → AuthService.ts                    │  │
│   │     ├── imports → UserRepository.ts                  │  │
│   │     └── imports → types.ts                          │  │
│   │                                                      │  │
│   │   If AuthController is relevant, its imports are too │  │
│   └──────────────────────────────────────────────────────┘  │
│                                                             │
│   ┌──────────────────────────────────────────────────────┐  │
│   │           RULE-BASED (20%)                           │  │
│   │                                                      │  │
│   │   alwaysInclude: ["src/core/**"]                    │  │
│   │   neverInclude: ["**/*.test.ts"]                    │  │
│   │   priorityPatterns: ["*Controller*"]                │  │
│   └──────────────────────────────────────────────────────┘  │
│                                                             │
│   ═══════════════════════════════════════════════════════   │
│                                                             │
│   FINAL SCORE = 0.4×Semantic + 0.4×Dependency + 0.2×Rules  │
│                                                             │
│   AuthController.ts     → 0.91                             │
│   AuthService.ts        → 0.78                             │
│   RateLimiter.ts        → 0.75                             │
│   UserRepository.ts     → 0.62                             │
│   types.ts              → 0.45                             │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Signal 1: Semantic Similarity

We use **vector embeddings** to find files semantically related to your goal.

### How It Works

1. **Your goal** is converted to a vector embedding
2. **Each file** in your codebase has a pre-computed embedding
3. We calculate **cosine similarity** between goal and files
4. Files with similar concepts rank higher

### Example

```
Goal: "Add authentication to API endpoints"

High Semantic Match:
  ✓ AuthMiddleware.ts (0.92) - contains "authenticate", "API"
  ✓ JWTValidator.ts (0.85) - contains "token", "auth"

Low Semantic Match:
  ✗ DatabaseMigration.ts (0.12) - unrelated concepts
```

## Signal 2: Dependency Graph

We use **Tree-sitter parsing** to build a complete import graph.

### How It Works

1. Parse all files with Tree-sitter
2. Extract import/export statements
3. Build directed dependency graph
4. Propagate relevance through connections

### Example

```
AuthController.ts imports:
├── AuthService.ts        → Highly relevant (direct import)
│   └── JWTService.ts     → Relevant (2 hops)
├── UserRepository.ts     → Relevant (direct import)
└── express               → Ignored (external)
```

### Graph Propagation

If AuthController has score 0.9, its imports get boosted:
- Direct imports: +0.3 boost
- Indirect imports (2 hops): +0.15 boost
- Beyond 3 hops: Minimal boost

## Signal 3: Rule-Based Scoring

User-defined rules provide explicit control.

### Configuration

```yaml
# .contextos/context.yaml
constraints:
  alwaysInclude:
    - src/core/types.ts
    - src/config/*.ts
  
  neverInclude:
    - "**/*.test.ts"
    - "**/__mocks__/**"
  
  priorityPatterns:
    - pattern: "*Controller*"
      boost: 0.2
    - pattern: "*Service*"
      boost: 0.1
```

## Token Budget Optimization

After ranking, we fit files into your token budget:

```
Budget: 50,000 tokens

┌────────────────────────────────────┬────────┬─────────┐
│ File                               │ Tokens │ Cumulative│
├────────────────────────────────────┼────────┼─────────┤
│ AuthController.ts (0.91)           │ 2,340  │ 2,340   │
│ AuthService.ts (0.78)              │ 1,890  │ 4,230   │
│ RateLimiter.ts (0.75)              │ 980    │ 5,210   │
│ UserRepository.ts (0.62)           │ 1,560  │ 6,770   │
│ types.ts (0.45)                    │ 890    │ 7,660   │
│ ...                                │ ...    │ ...     │
├────────────────────────────────────┼────────┼─────────┤
│ TOTAL                              │        │ 48,500  │
└────────────────────────────────────┴────────┴─────────┘
```

Files are added in order of score until budget is reached.

## The RLM Engine

For complex goals, the **Recursive Language Model** engine goes deeper:

```
Goal: "Refactor AuthController to use dependency injection"

RLM Depth 0:
  ├─ Analyze goal
  ├─ Identify: AuthController needs refactoring
  └─ Sub-goal: "Find all dependencies of AuthController"

RLM Depth 1:
  ├─ Execute sub-goal
  ├─ Found: AuthService, UserRepository, Logger
  └─ Sub-goal: "Understand DI patterns in codebase"

RLM Depth 2:
  ├─ Execute sub-goal
  ├─ Found: DIContainer.ts, Injectable decorator
  └─ Return: Complete dependency map

Final Output: Comprehensive context with full DI understanding
```

## Performance

| Codebase Size | Index Time | Build Time |
|---------------|------------|------------|
| 100 files | ~2s | <100ms |
| 1,000 files | ~15s | ~500ms |
| 10,000 files | ~2min | ~2s |

Index is cached and updated incrementally.

## Comparison

| Approach | Precision | Recall | Time |
|----------|-----------|--------|------|
| Manual selection | High | Low | Slow |
| Grep/search | Low | Medium | Fast |
| AI guess | Medium | Medium | N/A |
| **ContextOS** | **High** | **High** | **Fast** |

## Next Steps

- [Configuration](/guide/configuration) - Tune the ranking weights
- [RLM Engine](/concepts/rlm-engine) - Deep dive into recursive analysis
- [API Reference](/api/core) - Use ContextOS programmatically
