# API Reference

ContextOS provides three npm packages for different use cases.

## Packages

### @contextos/cli

Command-line interface for ContextOS.

```bash
npm install -g @contextos/cli
```

### @contextos/core

Core engine with all modules. For building integrations.

```bash
npm install @contextos/core
```

### @contextos/sdk

Lightweight SDK for tool builders.

```bash
npm install @contextos/sdk
```

## Core Modules

### RLM Engine

```typescript
import { 
  RLMEngine, 
  createContextAPI,
  LocalSandbox,
  ProposalManager,
  Blackboard,
  ScopeManager,
  Watchdog,
} from '@contextos/core';

const engine = new RLMEngine({
  maxDepth: 3,
  maxIterations: 10,
  maxTokenBudget: 50000,
});

const result = await engine.execute(goal, context);
```

### Model Adapters

```typescript
import { 
  OpenAIAdapter,
  AnthropicAdapter,
  createGeminiClient,
} from '@contextos/core';

// Gemini
const gemini = createGeminiClient();

// OpenAI
const openai = new OpenAIAdapter('gpt-4');

// Anthropic  
const anthropic = new AnthropicAdapter('claude-3-opus');
```

### Parsers

```typescript
import {
  ASTParser,
  parseWithRegex,
  detectProjectType,
  getSupportedLanguages,
} from '@contextos/core';

// Regex-based (no WASM needed)
const result = parseWithRegex(code, 'typescript');
console.log(result.imports, result.functions, result.classes);

// Supported: typescript, javascript, python, go, rust, java
```

### Context Building

```typescript
import {
  getContextBuilder,
  HybridRanker,
  TokenBudget,
} from '@contextos/core';

const builder = await getContextBuilder();
const context = await builder.build({
  goal: 'Add authentication',
  maxTokens: 32000,
});
```

### Error Handling

```typescript
import {
  ContextOSError,
  ErrorCode,
  Errors,
} from '@contextos/core';

try {
  // ...
} catch (error) {
  if (error instanceof ContextOSError) {
    console.log(error.code);        // E4001
    console.log(error.toCliString()); // Formatted output
    console.log(error.suggestions);  // Actionable fixes
  }
}
```

### Logging

```typescript
import { 
  Logger, 
  LogLevel, 
  createLogger,
} from '@contextos/core';

const logger = createLogger({ level: LogLevel.DEBUG });
logger.info('Processing', { files: 10 });
logger.time('build');
// ... work
logger.timeEnd('build');
```
