import { defineConfig } from 'vitepress'

export default defineConfig({
    title: 'ContextOS',
    description: 'The Context Server Protocol for AI Coding',

    head: [
        ['link', { rel: 'icon', href: '/favicon.ico' }],
        ['meta', { name: 'theme-color', content: '#3b82f6' }],
    ],

    themeConfig: {
        logo: '/logo.svg',

        nav: [
            { text: 'Guide', link: '/guide/getting-started' },
            { text: 'API', link: '/api/' },
            { text: 'CLI', link: '/cli/' },
            { text: 'RLM', link: '/rlm/' },
            {
                text: 'v0.1.0',
                items: [
                    { text: 'Changelog', link: '/changelog' },
                    { text: 'Contributing', link: '/contributing' },
                ],
            },
        ],

        sidebar: {
            '/guide/': [
                {
                    text: 'Introduction',
                    items: [
                        { text: 'What is ContextOS?', link: '/guide/what-is-contextos' },
                        { text: 'Getting Started', link: '/guide/getting-started' },
                        { text: 'Core Concepts', link: '/guide/concepts' },
                    ],
                },
                {
                    text: 'Configuration',
                    items: [
                        { text: 'context.yaml', link: '/guide/context-yaml' },
                        { text: 'config.yaml', link: '/guide/config-yaml' },
                        { text: 'Constraints', link: '/guide/constraints' },
                        { text: 'Boundaries', link: '/guide/boundaries' },
                    ],
                },
                {
                    text: 'Advanced',
                    items: [
                        { text: 'Multi-Language Support', link: '/guide/multi-language' },
                        { text: 'Token Budgeting', link: '/guide/token-budgeting' },
                        { text: 'Hybrid Ranking', link: '/guide/hybrid-ranking' },
                    ],
                },
            ],
            '/cli/': [
                {
                    text: 'CLI Commands',
                    items: [
                        { text: 'Overview', link: '/cli/' },
                        { text: 'ctx init', link: '/cli/init' },
                        { text: 'ctx index', link: '/cli/index' },
                        { text: 'ctx build', link: '/cli/build' },
                        { text: 'ctx goal', link: '/cli/goal' },
                        { text: 'ctx analyze', link: '/cli/analyze' },
                        { text: 'ctx refactor', link: '/cli/refactor' },
                        { text: 'ctx explain', link: '/cli/explain' },
                        { text: 'ctx doctor', link: '/cli/doctor' },
                    ],
                },
            ],
            '/rlm/': [
                {
                    text: 'RLM Engine',
                    items: [
                        { text: 'Overview', link: '/rlm/' },
                        { text: 'How It Works', link: '/rlm/how-it-works' },
                        { text: 'Sandbox', link: '/rlm/sandbox' },
                        { text: 'Context API', link: '/rlm/context-api' },
                        { text: 'Model Adapters', link: '/rlm/adapters' },
                    ],
                },
                {
                    text: 'Safety Features',
                    items: [
                        { text: 'Proposal System', link: '/rlm/proposal' },
                        { text: 'Blackboard', link: '/rlm/blackboard' },
                        { text: 'Watchdog', link: '/rlm/watchdog' },
                    ],
                },
            ],
            '/api/': [
                {
                    text: 'API Reference',
                    items: [
                        { text: 'Overview', link: '/api/' },
                        { text: '@contextos/core', link: '/api/core' },
                        { text: '@contextos/cli', link: '/api/cli' },
                        { text: '@contextos/sdk', link: '/api/sdk' },
                    ],
                },
            ],
        },

        socialLinks: [
            { icon: 'github', link: 'https://github.com/contextos/contextos' },
            { icon: 'twitter', link: 'https://twitter.com/contextos' },
            { icon: 'discord', link: 'https://discord.gg/contextos' },
        ],

        footer: {
            message: 'Released under the MIT License.',
            copyright: 'Copyright © 2024-2026 ContextOS Team',
        },

        search: {
            provider: 'local',
        },
    },
})
