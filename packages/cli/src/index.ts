#!/usr/bin/env node
/**
 * ContextOS CLI
 * The Context Server Protocol for AI Coding
 */

import { Command } from 'commander';
import { join } from 'path';
import { existsSync, mkdirSync, appendFileSync } from 'fs';

/**
 * Global error handlers for production stability (Fix G1: Global Error Handlers)
 */

// Ensure crash log directory exists
const crashLogDir = join(process.cwd(), '.contextos');
if (!existsSync(crashLogDir)) {
    mkdirSync(crashLogDir, { recursive: true });
}
const crashLogPath = join(crashLogDir, 'crash.log');

function logCrash(message: string, data?: string): void {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] ${message}${data ? `\n${data}\n\n` : '\n\n'}`;
    console.error(logEntry);
    appendFileSync(crashLogPath, logEntry, 'utf-8');
}

// Uncaught Exception Handler
process.on('uncaughtException', (error: Error) => {
    console.error('❌ UNCAUGHT EXCEPTION:', error.message);
    console.error('Stack:', error.stack);

    // Log to file if in production
    if (process.env.NODE_ENV === 'production') {
        logCrash(`UNCAUGHT EXCEPTION: ${error.message}`, error.stack);
    }

    // Give time for logging, then exit
    setTimeout(() => process.exit(1), 1000);
});

// Unhandled Rejection Handler
process.on('unhandledRejection', (reason: unknown) => {
    console.error('❌ UNHANDLED REJECTION:', reason);

    // Log to file if in production
    if (process.env.NODE_ENV === 'production') {
        const reasonStr = reason instanceof Error ? reason.stack : String(reason);
        logCrash('UNHANDLED REJECTION', reasonStr);
    }

    // Don't exit - keep process running
});

// Warning: Multiple resolutions of promise
process.on('multipleResolves', (type, promise) => {
    console.warn('⚠️  MULTIPLE RESOLVES:', type, promise);
});

// Warning: Unhandled promise rejection
process.on('warning', (warning) => {
    console.warn('⚠️  PROCESS WARNING:', warning.name, warning.message);
});
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
import { registerGenerateCommands } from './commands/generate.js';

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
registerGenerateCommands(program);

// Parse and execute
program.parse();


