#!/usr/bin/env node
/**
 * ContextOS CLI
 * The Context Server Protocol for AI Coding
 */

import { Command } from 'commander';
import { initCommand } from './commands/init.js';
import { indexCommand } from './commands/index.js';
import { buildCommand } from './commands/build.js';
import { goalCommand } from './commands/goal.js';
import { previewCommand } from './commands/preview.js';
import { copyCommand } from './commands/copy.js';
import { doctorCommand } from './commands/doctor.js';
import { suggestRulesCommand } from './commands/suggest-rules.js';
import { configCommand } from './commands/config.js';
import { analyzeCommand } from './commands/analyze.js';
import { refactorCommand } from './commands/refactor.js';
import { explainCommand } from './commands/explain.js';
import { traceCommand } from './commands/trace.js';
import { registerPluginCommand } from './commands/plugin.js';
import { registerFinetuneCommand } from './commands/finetune.js';
import { registerCloudCommands } from './commands/cloud.js';

const program = new Command();

program
    .name('ctx')
    .description('ContextOS - The Context Server Protocol for AI Coding')
    .version('0.1.0')
    .option('-v, --verbose', 'Enable verbose output');

// Register commands
program.addCommand(initCommand);
program.addCommand(indexCommand);
program.addCommand(buildCommand);
program.addCommand(goalCommand);
program.addCommand(previewCommand);
program.addCommand(copyCommand);
program.addCommand(doctorCommand);
program.addCommand(configCommand);
program.addCommand(suggestRulesCommand);
program.addCommand(analyzeCommand);
program.addCommand(refactorCommand);
program.addCommand(explainCommand);
program.addCommand(traceCommand);

// Register plugin commands
registerPluginCommand(program);
registerFinetuneCommand(program);
registerCloudCommands(program);

// Parse and execute
program.parse();

