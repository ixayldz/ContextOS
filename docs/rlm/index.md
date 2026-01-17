# RLM Engine Overview

The **Recursive Language Model (RLM) Engine** is the core of ContextOS, implementing the paradigm from MIT CSAIL's research paper.

## The Key Insight

Traditional LLMs treat context as **static input** - you paste code, and the model processes it linearly. This leads to "context rot" where important information gets lost in long contexts.

RLM treats context as an **external environment** that can be queried programmatically:

```
Traditional:  LLM(static_context + question) → answer

RLM:          LLM(question) → code → execute(env) → observe → repeat
```

## How It Works

### 1. Query Phase
The model receives your goal and writes code to explore the codebase:

```javascript
// Model writes this to explore
const authFiles = ctx.find('**/auth/**/*.ts');
const deps = ctx.getDependencies('AuthService', 2);
```

### 2. Execute Phase
The code runs in a sandboxed environment with access to:
- File system (read-only)
- AST parsing
- Dependency graph
- Vector search

### 3. Observe Phase
The execution results become new context:

```
Found 5 auth files:
- src/auth/AuthService.ts
- src/auth/guards/JwtGuard.ts
- ...

Dependencies of AuthService:
- UserRepository (direct)
- ConfigService (transitive)
```

### 4. Repeat
The model can spawn **sub-agents** for parallel exploration, continuing until the goal is achieved or budget is exhausted.

## Safety Features

| Feature | Description |
|---------|-------------|
| **Sandbox** | VM-based isolation, no network/disk writes |
| **Watchdog** | Terminates stuck processes |
| **Budget** | Token and depth limits |
| **Proposals** | Write operations are proposals, not direct |

## Model Adapters

RLM works with any model through adapters:

```typescript
import { RLMEngine, OpenAIAdapter } from '@contextos/core';

const engine = new RLMEngine({
    maxDepth: 3,
    maxTokenBudget: 50000,
});

engine.setModelAdapter(new OpenAIAdapter('gpt-4'));
const result = await engine.execute(goal, context);
```

## CLI Integration

RLM powers these CLI commands:

- `ctx analyze` - Deep codebase analysis
- `ctx refactor` - Safe refactoring with impact analysis
- `ctx explain` - AI-powered code explanation
