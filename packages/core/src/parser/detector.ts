/**
 * Project Type Detector
 * Auto-discovers language, framework, and package manager from project files
 */

import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import type { DetectedProject, SupportedLanguage } from '../types.js';

interface DetectorRule {
    language: SupportedLanguage;
    files: string[];
    framework?: {
        file: string;
        patterns: { [key: string]: string };
    };
    packageManager?: string;
}

const DETECTOR_RULES: DetectorRule[] = [
    // TypeScript/JavaScript (Node.js)
    {
        language: 'typescript',
        files: ['tsconfig.json'],
        framework: {
            file: 'package.json',
            patterns: {
                '@nestjs/core': 'nestjs',
                'next': 'nextjs',
                'nuxt': 'nuxt',
                'express': 'express',
                'fastify': 'fastify',
                'react': 'react',
                'vue': 'vue',
                '@angular/core': 'angular',
                'svelte': 'svelte',
            },
        },
    },
    {
        language: 'javascript',
        files: ['package.json'],
        framework: {
            file: 'package.json',
            patterns: {
                '@nestjs/core': 'nestjs',
                'next': 'nextjs',
                'nuxt': 'nuxt',
                'express': 'express',
                'fastify': 'fastify',
                'react': 'react',
                'vue': 'vue',
                '@angular/core': 'angular',
                'svelte': 'svelte',
            },
        },
    },
    // Python
    {
        language: 'python',
        files: ['requirements.txt', 'pyproject.toml', 'setup.py', 'Pipfile'],
        framework: {
            file: 'requirements.txt',
            patterns: {
                'django': 'django',
                'flask': 'flask',
                'fastapi': 'fastapi',
                'pyramid': 'pyramid',
                'tornado': 'tornado',
            },
        },
    },
    // Go
    {
        language: 'go',
        files: ['go.mod'],
        framework: {
            file: 'go.mod',
            patterns: {
                'github.com/gin-gonic/gin': 'gin',
                'github.com/gofiber/fiber': 'fiber',
                'github.com/labstack/echo': 'echo',
                'github.com/gorilla/mux': 'gorilla',
            },
        },
    },
    // Rust
    {
        language: 'rust',
        files: ['Cargo.toml'],
        framework: {
            file: 'Cargo.toml',
            patterns: {
                'actix-web': 'actix',
                'rocket': 'rocket',
                'axum': 'axum',
                'warp': 'warp',
            },
        },
    },
    // Java
    {
        language: 'java',
        files: ['pom.xml', 'build.gradle', 'build.gradle.kts'],
        framework: {
            file: 'pom.xml',
            patterns: {
                'spring-boot': 'spring-boot',
                'quarkus': 'quarkus',
                'micronaut': 'micronaut',
            },
        },
    },
];

const PACKAGE_MANAGERS: { [key: string]: string } = {
    'pnpm-lock.yaml': 'pnpm',
    'yarn.lock': 'yarn',
    'package-lock.json': 'npm',
    'bun.lockb': 'bun',
    'Pipfile.lock': 'pipenv',
    'poetry.lock': 'poetry',
    'Cargo.lock': 'cargo',
    'go.sum': 'go',
};

const ENTRY_POINTS: { [key: string]: string[] } = {
    typescript: ['src/index.ts', 'src/main.ts', 'index.ts', 'main.ts'],
    javascript: ['src/index.js', 'src/main.js', 'index.js', 'main.js'],
    python: ['src/main.py', 'main.py', 'app.py', 'src/app.py'],
    go: ['main.go', 'cmd/main.go'],
    rust: ['src/main.rs', 'src/lib.rs'],
    java: ['src/main/java', 'src/Main.java'],
};

/**
 * Detect project type from directory
 */
export async function detectProjectType(projectDir: string): Promise<DetectedProject> {
    let detected: DetectedProject = {
        language: 'typescript', // default
        entryPoints: [],
        configFiles: [],
    };

    // Check for language indicators
    for (const rule of DETECTOR_RULES) {
        for (const file of rule.files) {
            const filePath = join(projectDir, file);
            if (existsSync(filePath)) {
                detected.language = rule.language;
                detected.configFiles.push(file);

                // Check for framework
                if (rule.framework) {
                    const frameworkFilePath = join(projectDir, rule.framework.file);
                    if (existsSync(frameworkFilePath)) {
                        try {
                            const content = readFileSync(frameworkFilePath, 'utf-8');
                            for (const [pattern, framework] of Object.entries(rule.framework.patterns)) {
                                if (content.includes(pattern)) {
                                    detected.framework = framework;
                                    break;
                                }
                            }
                        } catch {
                            // Ignore read errors
                        }
                    }
                }
                break;
            }
        }
        if (detected.configFiles.length > 0) break;
    }

    // Detect package manager
    for (const [lockFile, manager] of Object.entries(PACKAGE_MANAGERS)) {
        if (existsSync(join(projectDir, lockFile))) {
            detected.packageManager = manager;
            break;
        }
    }

    // Find entry points
    const possibleEntries = ENTRY_POINTS[detected.language] || [];
    for (const entry of possibleEntries) {
        if (existsSync(join(projectDir, entry))) {
            detected.entryPoints.push(entry);
        }
    }

    return detected;
}

/**
 * Get language file extensions
 */
export function getLanguageExtensions(language: SupportedLanguage): string[] {
    const extensions: { [key: string]: string[] } = {
        typescript: ['.ts', '.tsx', '.mts', '.cts'],
        javascript: ['.js', '.jsx', '.mjs', '.cjs'],
        python: ['.py', '.pyi'],
        go: ['.go'],
        rust: ['.rs'],
        java: ['.java'],
    };
    return extensions[language] || [];
}

/**
 * Get Tree-sitter grammar name for language
 */
export function getTreeSitterLanguage(language: SupportedLanguage): string {
    const mapping: { [key: string]: string } = {
        typescript: 'typescript',
        javascript: 'javascript',
        python: 'python',
        go: 'go',
        rust: 'rust',
        java: 'java',
    };
    return mapping[language] || language;
}
