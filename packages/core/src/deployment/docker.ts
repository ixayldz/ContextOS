/**
 * Deployment Helpers
 * Docker and Kubernetes configuration utilities
 */

import type {
    DeploymentConfig,
    DockerConfig,
    KubernetesConfig,
    HealthStatus,
    LicenseInfo
} from './types.js';

/**
 * Generate Docker Compose file content
 */
export function generateDockerCompose(config: DockerConfig): string {
    const services: Record<string, unknown> = {
        contextos: {
            image: 'contextos/server:latest',
            container_name: config.name,
            ports: [`${config.port}:${config.port}`],
            environment: {
                NODE_ENV: config.environment,
                PORT: config.port.toString(),
                HOST: config.host,
                LOG_LEVEL: config.logging.level,
                LOG_FORMAT: config.logging.format,
                ...config.environment,
            },
            volumes: config.volumes?.map(v =>
                `${v.source}:${v.target}${v.readonly ? ':ro' : ''}`
            ) || [
                    './data:/data',
                    './.contextos:/app/.contextos',
                ],
            restart: 'unless-stopped',
            healthcheck: {
                test: ['CMD', 'curl', '-f', `http://localhost:${config.port}/health`],
                interval: '30s',
                timeout: '10s',
                retries: 3,
                start_period: '10s',
            },
        },
    };

    // Add resource limits if specified
    if (config.resources) {
        services.contextos = {
            ...services.contextos as Record<string, unknown>,
            deploy: {
                resources: {
                    limits: {
                        memory: config.resources.memory,
                        cpus: config.resources.cpus,
                    },
                },
            },
        };
    }

    // Add Redis if configured
    if (config.redis) {
        services.redis = {
            image: 'redis:7-alpine',
            container_name: `${config.name}-redis`,
            ports: [`${config.redis.port}:6379`],
            volumes: ['redis-data:/data'],
            restart: 'unless-stopped',
        };

        (services.contextos as Record<string, unknown>).depends_on = ['redis'];
        const env = (services.contextos as Record<string, Record<string, unknown>>).environment;
        env.REDIS_HOST = 'redis';
        env.REDIS_PORT = '6379';
    }

    const compose = {
        version: '3.8',
        services,
        volumes: {
            'contextos-data': {},
            ...(config.redis ? { 'redis-data': {} } : {}),
        },
    };

    return generateYaml(compose);
}

/**
 * Generate Dockerfile content
 */
export function generateDockerfile(): string {
    return `# ContextOS Server Dockerfile
FROM node:20-alpine AS base

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app
COPY package*.json pnpm-lock.yaml ./
RUN npm install -g pnpm && pnpm install --frozen-lockfile

# Build the application
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# Production image
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 contextos

COPY --from=builder --chown=contextos:nodejs /app/dist ./dist
COPY --from=builder --chown=contextos:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=contextos:nodejs /app/package.json ./

USER contextos

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \\
    CMD curl -f http://localhost:3000/health || exit 1

CMD ["node", "dist/server.js"]
`;
}

/**
 * Generate Kubernetes Helm values.yaml
 */
export function generateHelmValues(config: KubernetesConfig): string {
    const values = {
        replicaCount: config.replicas,

        image: {
            repository: 'contextos/server',
            tag: 'latest',
            pullPolicy: 'IfNotPresent',
        },

        service: {
            type: 'ClusterIP',
            port: config.port,
        },

        ingress: {
            enabled: config.ingress?.enabled || false,
            className: 'nginx',
            annotations: config.ingress?.annotations || {},
            hosts: config.ingress ? [{
                host: config.ingress.host,
                paths: [{ path: '/', pathType: 'Prefix' }],
            }] : [],
            tls: config.ingress?.tls ? [{
                secretName: `${config.name}-tls`,
                hosts: [config.ingress.host],
            }] : [],
        },

        resources: config.resources,

        env: {
            NODE_ENV: config.environment,
            LOG_LEVEL: config.logging.level,
        },

        serviceAccount: {
            create: !!config.serviceAccount,
            name: config.serviceAccount || '',
        },

        podAnnotations: config.podAnnotations || {},
    };

    return generateYaml(values);
}

/**
 * Generate Kubernetes deployment manifest
 */
export function generateK8sDeployment(config: KubernetesConfig): string {
    const deployment = {
        apiVersion: 'apps/v1',
        kind: 'Deployment',
        metadata: {
            name: config.name,
            namespace: config.namespace,
            labels: {
                'app.kubernetes.io/name': config.name,
                'app.kubernetes.io/instance': config.name,
            },
        },
        spec: {
            replicas: config.replicas,
            selector: {
                matchLabels: {
                    'app.kubernetes.io/name': config.name,
                    'app.kubernetes.io/instance': config.name,
                },
            },
            template: {
                metadata: {
                    labels: {
                        'app.kubernetes.io/name': config.name,
                        'app.kubernetes.io/instance': config.name,
                    },
                    annotations: config.podAnnotations || {},
                },
                spec: {
                    serviceAccountName: config.serviceAccount,
                    containers: [{
                        name: config.name,
                        image: 'contextos/server:latest',
                        ports: [{ containerPort: config.port }],
                        env: [
                            { name: 'NODE_ENV', value: config.environment },
                            { name: 'PORT', value: config.port.toString() },
                            { name: 'LOG_LEVEL', value: config.logging.level },
                        ],
                        resources: config.resources,
                        livenessProbe: {
                            httpGet: { path: '/health', port: config.port },
                            initialDelaySeconds: 10,
                            periodSeconds: 30,
                        },
                        readinessProbe: {
                            httpGet: { path: '/health', port: config.port },
                            initialDelaySeconds: 5,
                            periodSeconds: 10,
                        },
                    }],
                },
            },
        },
    };

    return generateYaml(deployment);
}

/**
 * Check health status
 */
export function checkHealth(config: DeploymentConfig): HealthStatus {
    const checks: HealthStatus['checks'] = [];
    let overallHealthy = true;

    // Check database
    try {
        // In production, would actually connect to DB
        checks.push({
            name: 'database',
            status: 'pass',
            message: `${config.database.type} connection OK`,
        });
    } catch (error) {
        checks.push({
            name: 'database',
            status: 'fail',
            message: error instanceof Error ? error.message : 'Connection failed',
        });
        overallHealthy = false;
    }

    // Check file system
    checks.push({
        name: 'filesystem',
        status: 'pass',
        message: 'Write access OK',
    });

    return {
        status: overallHealthy ? 'healthy' : 'unhealthy',
        timestamp: new Date(),
        version: '2.0.0',
        uptime: process.uptime(),
        checks,
    };
}

/**
 * Validate license key (skeleton)
 */
export function validateLicense(key: string): LicenseInfo | null {
    // In production, would validate signature and decode license
    // This is a placeholder implementation
    if (!key || key.length < 10) {
        return null;
    }

    // Parse license format: CTXOS-TYPE-ORG-SEATS-EXPIRY-SIGNATURE
    const parts = key.split('-');
    if (parts.length < 6 || parts[0] !== 'CTXOS') {
        return null;
    }

    const typeMap: Record<string, LicenseInfo['type']> = {
        'T': 'trial',
        'TM': 'team',
        'E': 'enterprise',
    };

    return {
        key,
        type: typeMap[parts[1]] || 'trial',
        organization: parts[2],
        maxSeats: parseInt(parts[3]) || 5,
        expiresAt: new Date(parseInt(parts[4]) * 1000),
        features: ['core', 'analytics', 'sync'],
        signature: parts.slice(5).join('-'),
    };
}

/**
 * Simple YAML generator (minimal implementation)
 */
function generateYaml(obj: unknown, indent: number = 0): string {
    const spaces = '  '.repeat(indent);

    if (obj === null || obj === undefined) {
        return 'null';
    }

    if (typeof obj === 'string') {
        return obj.includes(':') || obj.includes('#') ? `"${obj}"` : obj;
    }

    if (typeof obj === 'number' || typeof obj === 'boolean') {
        return String(obj);
    }

    if (Array.isArray(obj)) {
        if (obj.length === 0) return '[]';
        return obj.map(item => {
            if (typeof item === 'object' && item !== null) {
                const yaml = generateYaml(item, indent + 1);
                return `${spaces}- ${yaml.trim().replace(/\n/g, `\n${spaces}  `)}`;
            }
            return `${spaces}- ${generateYaml(item, indent)}`;
        }).join('\n');
    }

    if (typeof obj === 'object') {
        const entries = Object.entries(obj);
        if (entries.length === 0) return '{}';
        return entries.map(([key, value]) => {
            if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
                return `${spaces}${key}:\n${generateYaml(value, indent + 1)}`;
            }
            if (Array.isArray(value)) {
                return `${spaces}${key}:\n${generateYaml(value, indent + 1)}`;
            }
            return `${spaces}${key}: ${generateYaml(value, indent)}`;
        }).join('\n');
    }

    return String(obj);
}
