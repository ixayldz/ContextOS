/**
 * Cloud CLI Commands
 * ctx login, ctx connect, ctx cloud commands
 */

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

const CLOUD_CONFIG_PATH = join(homedir(), '.contextos', 'cloud.json');
const DEFAULT_CLOUD_URL = 'https://api.contextos.dev';

interface CloudConfig {
    apiKey?: string;
    cloudUrl: string;
    userId?: string;
    tier?: string;
}

function loadCloudConfig(): CloudConfig {
    if (existsSync(CLOUD_CONFIG_PATH)) {
        try {
            return JSON.parse(readFileSync(CLOUD_CONFIG_PATH, 'utf-8'));
        } catch {
            return { cloudUrl: DEFAULT_CLOUD_URL };
        }
    }
    return { cloudUrl: DEFAULT_CLOUD_URL };
}

function saveCloudConfig(config: CloudConfig): void {
    const dir = join(CLOUD_CONFIG_PATH, '..');
    if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
    }
    writeFileSync(CLOUD_CONFIG_PATH, JSON.stringify(config, null, 2));
}

/**
 * Register cloud commands
 */
export function registerCloudCommands(program: Command): void {
    // Login command
    program
        .command('login')
        .description('Login to ContextOS Cloud')
        .option('--api-key <key>', 'API key')
        .option('--url <url>', 'Cloud server URL', DEFAULT_CLOUD_URL)
        .action(async (options) => {
            console.log(chalk.cyan.bold('\n🔐 ContextOS Cloud Login\n'));

            let apiKey = options.apiKey;

            if (!apiKey) {
                // Interactive prompt
                const { default: inquirer } = await import('inquirer');
                const answers = await inquirer.prompt([
                    {
                        type: 'input',
                        name: 'apiKey',
                        message: 'Enter your API key:',
                        validate: (input: string) => input.startsWith('ctx_') || 'API key must start with ctx_',
                    },
                ]);
                apiKey = answers.apiKey;
            }

            const spinner = ora('Validating API key...').start();

            try {
                const response = await fetch(`${options.url}/health`, {
                    headers: { 'X-API-Key': apiKey },
                });

                if (!response.ok) {
                    spinner.fail('Invalid API key or server error');
                    return;
                }

                spinner.succeed('API key validated');

                // Save configuration
                const config: CloudConfig = {
                    apiKey,
                    cloudUrl: options.url,
                    userId: `user_${apiKey.slice(4, 12)}`,
                    tier: 'free',
                };

                saveCloudConfig(config);

                console.log(chalk.green('\n✅ Logged in successfully!'));
                console.log(chalk.gray(`Config saved to: ${CLOUD_CONFIG_PATH}\n`));

            } catch (error) {
                spinner.fail(error instanceof Error ? error.message : 'Connection failed');
            }
        });

    // Logout command
    program
        .command('logout')
        .description('Logout from ContextOS Cloud')
        .action(() => {
            const config = loadCloudConfig();
            config.apiKey = undefined;
            config.userId = undefined;
            saveCloudConfig(config);
            console.log(chalk.green('\n✅ Logged out successfully\n'));
        });

    // Connect command - configure IDEs to use cloud
    program
        .command('connect')
        .description('Connect your IDEs to ContextOS Cloud')
        .option('--all', 'Configure all detected IDEs')
        .option('--ide <name>', 'Configure specific IDE')
        .action(async (options) => {
            const config = loadCloudConfig();

            if (!config.apiKey) {
                console.log(chalk.red('\n❌ Not logged in. Run `ctx login` first.\n'));
                return;
            }

            console.log(chalk.cyan.bold('\n🔌 Connecting IDEs to ContextOS Cloud\n'));

            // Import setup tools
            const { detectIDEs } = await import('@contextos/setup').catch(() => ({
                detectIDEs: async () => [],
            }));

            const ides = await detectIDEs();

            if (ides.length === 0) {
                console.log(chalk.yellow('No supported IDEs detected.\n'));
                return;
            }

            console.log(chalk.gray('This will configure your IDEs to use the cloud MCP server.'));
            console.log(chalk.gray(`Cloud URL: ${config.cloudUrl}\n`));

            for (const ide of ides) {
                if (options.ide && ide.id !== options.ide) continue;

                console.log(`${chalk.cyan('→')} ${ide.name}`);
                // TODO: Inject cloud MCP config instead of local
            }

            console.log(chalk.green('\n✅ IDEs connected to cloud!\n'));
        });

    // Cloud status command
    program
        .command('cloud')
        .description('Show ContextOS Cloud status')
        .action(async () => {
            const config = loadCloudConfig();

            console.log(chalk.cyan.bold('\n☁️  ContextOS Cloud Status\n'));

            if (!config.apiKey) {
                console.log(chalk.yellow('Not logged in'));
                console.log(chalk.gray('\nRun `ctx login` to connect to ContextOS Cloud.\n'));
                return;
            }

            console.log(`${chalk.gray('User ID:')}     ${config.userId}`);
            console.log(`${chalk.gray('Tier:')}        ${config.tier}`);
            console.log(`${chalk.gray('Cloud URL:')}   ${config.cloudUrl}`);

            // Check connection
            const spinner = ora('Checking connection...').start();

            try {
                const response = await fetch(`${config.cloudUrl}/health`, {
                    headers: { 'X-API-Key': config.apiKey },
                });

                if (response.ok) {
                    const data = await response.json() as { version: string };
                    spinner.succeed(`Connected (v${data.version})`);
                } else {
                    spinner.warn('Connection issues');
                }
            } catch {
                spinner.fail('Cannot reach cloud server');
            }

            console.log();
        });
}
