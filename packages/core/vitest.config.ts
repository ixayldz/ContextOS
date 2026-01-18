import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        globals: true,
        environment: 'node',
        include: ['test/**/*.test.ts'],
        exclude: ['test/e2e/**/*.test.ts'],
        testTimeout: 10000,
        coverage: {
            provider: 'v8',
            reporter: ['text', 'json', 'html'],
            include: ['src/**/*.ts'],
            exclude: ['src/index.ts', 'src/**/*.d.ts'],
        },
    },
});

// Separate E2E config - run with: pnpm test:e2e
export const e2eConfig = defineConfig({
    test: {
        globals: true,
        environment: 'node',
        include: ['test/e2e/**/*.test.ts'],
        testTimeout: 120000, // 2 minutes for E2E
        retry: 1,
        bail: 1,
    },
});

