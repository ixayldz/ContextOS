/**
 * Context API Tests
 * Unit tests for programmatic context access API
 */

import { describe, it, expect } from 'vitest';
import {
    createContextAPI,
    mergeFilesToContext,
    splitContextToFiles,
} from '../src/rlm/context-api.js';

describe('createContextAPI', () => {
    describe('Basic Properties', () => {
        it('should return correct length', () => {
            const api = createContextAPI('Hello World');
            expect(api.length()).toBe(11);
        });

        it('should return correct line count', () => {
            const api = createContextAPI('line1\nline2\nline3');
            expect(api.lines()).toBe(3);
        });

        it('should handle empty context', () => {
            const api = createContextAPI('');
            expect(api.length()).toBe(0);
            expect(api.lines()).toBe(1); // Empty string has 1 "line"
        });
    });

    describe('Search Operations', () => {
        it('should find first occurrence', () => {
            const api = createContextAPI('The quick brown fox');
            expect(api.find('quick')).toBe(4);
        });

        it('should return -1 when not found', () => {
            const api = createContextAPI('The quick brown fox');
            expect(api.find('cat')).toBe(-1);
        });

        it('should find all occurrences', () => {
            const api = createContextAPI('foo bar foo baz foo');
            const indices = api.findAll('foo');
            expect(indices).toEqual([0, 8, 16]);
        });

        it('should search with regex', () => {
            const api = createContextAPI('Hello123World456');
            const match = api.search(/\d+/);
            expect(match?.[0]).toBe('123');
        });

        it('should grep matching lines', () => {
            const api = createContextAPI('function foo() {}\nconst bar = 1;\nfunction baz() {}');
            const results = api.grep('function');
            expect(results).toHaveLength(2);
            expect(results[0].line).toBe(1);
            expect(results[1].line).toBe(3);
        });
    });

    describe('Slicing Operations', () => {
        it('should slice by character index', () => {
            const api = createContextAPI('Hello World');
            expect(api.slice(0, 5)).toBe('Hello');
        });

        it('should get lines by number', () => {
            const api = createContextAPI('line1\nline2\nline3');
            expect(api.getLines(2, 2)).toBe('line2');
        });

        it('should get line range', () => {
            const api = createContextAPI('a\nb\nc\nd');
            expect(api.getLines(1, 3)).toBe('a\nb\nc');
        });

        it('should get head', () => {
            const api = createContextAPI('a\nb\nc\nd\ne');
            expect(api.head(2)).toBe('a\nb');
        });

        it('should get tail', () => {
            const api = createContextAPI('a\nb\nc\nd\ne');
            expect(api.tail(2)).toBe('d\ne');
        });
    });

    describe('Code-Specific Operations', () => {
        it('should extract function', () => {
            const code = `
function hello() {
    console.log("hello");
}

function world() {
    return 42;
}
`;
            const api = createContextAPI(code);
            const fn = api.getFunction('hello');

            expect(fn).toContain('function hello()');
            expect(fn).toContain('console.log');
        });

        it('should extract class', () => {
            const code = `
class MyClass {
    constructor() {
        this.x = 1;
    }

    method() {
        return this.x;
    }
}
`;
            const api = createContextAPI(code);
            const cls = api.getClass('MyClass');

            expect(cls).toContain('class MyClass');
            expect(cls).toContain('constructor');
            expect(cls).toContain('method');
        });

        it('should get imports', () => {
            const code = `
import { foo } from './foo';
import bar from 'bar';
const baz = require('baz');

function test() {}
`;
            const api = createContextAPI(code);
            const imports = api.getImports();

            expect(imports).toHaveLength(3);
            expect(imports[0]).toContain('import');
            expect(imports[2]).toContain('require');
        });

        it('should get exports', () => {
            const code = `
export function foo() {}
export const bar = 1;
export default class Baz {}
`;
            const api = createContextAPI(code);
            const exports = api.getExports();

            expect(exports.length).toBeGreaterThanOrEqual(3);
        });

        it('should get outline', () => {
            const code = `
export function foo() {}
export class Bar {}
interface Baz {}
type Qux = string;
`;
            const api = createContextAPI(code);
            const outline = api.getOutline();

            expect(outline.some(i => i.type === 'function' && i.name === 'foo')).toBe(true);
            expect(outline.some(i => i.type === 'class' && i.name === 'Bar')).toBe(true);
            expect(outline.some(i => i.type === 'interface' && i.name === 'Baz')).toBe(true);
            expect(outline.some(i => i.type === 'type' && i.name === 'Qux')).toBe(true);
        });
    });

    describe('Multi-File Operations', () => {
        it('should list files from merged context', () => {
            const context = `
=== FILE: src/index.ts ===
export * from './foo';

=== FILE: src/foo.ts ===
export function foo() {}
`;
            const api = createContextAPI(context);
            const files = api.listFiles();

            expect(files).toContain('src/index.ts');
            expect(files).toContain('src/foo.ts');
        });

        it('should return empty array for context without file markers', () => {
            const api = createContextAPI('just plain text');
            const files = api.listFiles();
            expect(files).toHaveLength(0);
        });
    });
});

describe('mergeFilesToContext', () => {
    it('should merge files with markers', () => {
        const files = [
            { path: 'a.ts', content: 'file a' },
            { path: 'b.ts', content: 'file b' },
        ];
        const context = mergeFilesToContext(files);

        expect(context).toContain('=== FILE: a.ts ===');
        expect(context).toContain('file a');
        expect(context).toContain('=== FILE: b.ts ===');
        expect(context).toContain('file b');
    });

    it('should handle empty file list', () => {
        const context = mergeFilesToContext([]);
        expect(context).toBe('');
    });
});

describe('splitContextToFiles', () => {
    it('should return correct number of files', () => {
        const original = [
            { path: 'x.ts', content: 'content x' },
            { path: 'y.ts', content: 'content y' },
        ];
        const merged = mergeFilesToContext(original);
        const split = splitContextToFiles(merged);

        expect(split).toHaveLength(2);
        expect(split[0].path).toBe('x.ts');
        expect(split[1].path).toBe('y.ts');
    });
});
