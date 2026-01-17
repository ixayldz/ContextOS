/**
 * Continue.dev Context Provider
 * Integrates ContextOS with Continue.dev IDE extension
 */

import ContextOS from './index.js';

export interface ContinueContextItem {
    name: string;
    description: string;
    content: string;
}

export interface ContinueContextProvider {
    title: string;
    displayTitle: string;
    description: string;
    getContextItems: (query: string) => Promise<ContinueContextItem[]>;
}

/**
 * Create a Continue.dev context provider
 */
export function createContinueProvider(options: {
    rootDir?: string;
    maxTokens?: number;
}): ContinueContextProvider {
    const contextos = new ContextOS(options);
    let initialized = false;

    return {
        title: 'contextos',
        displayTitle: 'ContextOS',
        description: 'Intelligent context from your codebase',

        async getContextItems(query: string): Promise<ContinueContextItem[]> {
            if (!initialized) {
                await contextos.initialize();
                initialized = true;
            }

            try {
                const result = await contextos.buildContext(query);

                return [
                    {
                        name: 'Project Context',
                        description: `Goal: ${result.goal} | ${result.files.length} files | ${result.tokenCount} tokens`,
                        content: result.content,
                    },
                ];
            } catch (error) {
                return [
                    {
                        name: 'ContextOS Error',
                        description: 'Failed to build context',
                        content: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
                    },
                ];
            }
        },
    };
}

/**
 * Continue.dev config.json integration
 * 
 * Add to your .continue/config.json:
 * {
 *   "contextProviders": [
 *     {
 *       "name": "contextos",
 *       "params": {
 *         "maxTokens": 32000
 *       }
 *     }
 *   ]
 * }
 */
export const continueConfig = {
    name: 'contextos',
    params: {
        maxTokens: 32000,
    },
};

export default createContinueProvider;
