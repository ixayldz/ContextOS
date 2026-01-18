/**
 * Deployment Types
 * Enterprise on-premise deployment configurations
 */

/**
 * Base deployment configuration
 */
export interface DeploymentConfig {
    /**
     * Deployment name
     */
    name: string;

    /**
     * Environment (development, staging, production)
     */
    environment: 'development' | 'staging' | 'production';

    /**
     * Port to listen on
     */
    port: number;

    /**
     * Host to bind to
     */
    host: string;

    /**
     * Enable HTTPS
     */
    https?: {
        enabled: boolean;
        certPath?: string;
        keyPath?: string;
    };

    /**
     * Database configuration
     */
    database: {
        type: 'sqlite' | 'postgres' | 'mysql';
        path?: string;
        host?: string;
        port?: number;
        database?: string;
        username?: string;
        password?: string;
    };

    /**
     * Redis configuration (optional)
     */
    redis?: {
        host: string;
        port: number;
        password?: string;
    };

    /**
     * Logging configuration
     */
    logging: {
        level: 'debug' | 'info' | 'warn' | 'error';
        format: 'json' | 'text';
        output: 'stdout' | 'file';
        filePath?: string;
    };
}

/**
 * License information for enterprise
 */
export interface LicenseInfo {
    /**
     * License key
     */
    key: string;

    /**
     * License type
     */
    type: 'trial' | 'team' | 'enterprise';

    /**
     * Organization name
     */
    organization: string;

    /**
     * Maximum seats/users
     */
    maxSeats: number;

    /**
     * Expiration date
     */
    expiresAt: Date;

    /**
     * Features enabled
     */
    features: string[];

    /**
     * Signature for validation
     */
    signature: string;
}

/**
 * SSO Configuration
 */
export interface SSOConfig {
    /**
     * SSO provider type
     */
    provider: 'saml' | 'oidc' | 'oauth2';

    /**
     * Identity provider URL
     */
    idpUrl: string;

    /**
     * Client ID
     */
    clientId: string;

    /**
     * Client secret (encrypted)
     */
    clientSecret: string;

    /**
     * Callback URL
     */
    callbackUrl: string;

    /**
     * Attribute mappings
     */
    attributeMapping?: {
        email?: string;
        name?: string;
        groups?: string;
    };
}

/**
 * LDAP Configuration
 */
export interface LDAPConfig {
    /**
     * LDAP server URL
     */
    url: string;

    /**
     * Base DN for searches
     */
    baseDN: string;

    /**
     * Bind DN
     */
    bindDN: string;

    /**
     * Bind password (encrypted)
     */
    bindPassword: string;

    /**
     * User search filter
     */
    userFilter: string;

    /**
     * Group search filter
     */
    groupFilter?: string;

    /**
     * TLS configuration
     */
    tls?: {
        enabled: boolean;
        rejectUnauthorized: boolean;
        certPath?: string;
    };
}

/**
 * Health check status
 */
export interface HealthStatus {
    status: 'healthy' | 'degraded' | 'unhealthy';
    timestamp: Date;
    version: string;
    uptime: number;
    checks: {
        name: string;
        status: 'pass' | 'fail' | 'warn';
        message?: string;
        latency?: number;
    }[];
}

/**
 * Docker deployment configuration
 */
export interface DockerConfig extends DeploymentConfig {
    /**
     * Container resource limits
     */
    resources?: {
        memory: string;
        cpus: string;
    };

    /**
     * Volume mounts
     */
    volumes?: {
        source: string;
        target: string;
        readonly?: boolean;
    }[];

    /**
     * Additional environment variables
     */
    envVars?: Record<string, string>;
}

/**
 * Kubernetes deployment configuration
 */
export interface KubernetesConfig extends DeploymentConfig {
    /**
     * Namespace
     */
    namespace: string;

    /**
     * Replica count
     */
    replicas: number;

    /**
     * Resource requests and limits
     */
    resources: {
        requests: {
            memory: string;
            cpu: string;
        };
        limits: {
            memory: string;
            cpu: string;
        };
    };

    /**
     * Ingress configuration
     */
    ingress?: {
        enabled: boolean;
        host: string;
        tls?: boolean;
        annotations?: Record<string, string>;
    };

    /**
     * Service account
     */
    serviceAccount?: string;

    /**
     * Pod annotations
     */
    podAnnotations?: Record<string, string>;
}
