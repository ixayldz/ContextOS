/**
 * RBAC (Role-Based Access Control) Module
 * Enterprise access control for team environments
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import crypto from 'crypto';

export type Permission =
    | 'context:read'
    | 'context:write'
    | 'config:read'
    | 'config:write'
    | 'rules:read'
    | 'rules:write'
    | 'sync:push'
    | 'sync:pull'
    | 'analytics:read'
    | 'analytics:export'
    | 'admin:users'
    | 'admin:roles';

export interface Role {
    id: string;
    name: string;
    description: string;
    permissions: Permission[];
    isBuiltIn: boolean;
}

export interface User {
    id: string;
    email: string;
    name: string;
    roles: string[];
    createdAt: string;
    lastActive?: string;
}

export interface AccessPolicy {
    resource: string;
    requiredPermissions: Permission[];
}

// Built-in roles
export const BUILT_IN_ROLES: Role[] = [
    {
        id: 'admin',
        name: 'Administrator',
        description: 'Full access to all features',
        permissions: [
            'context:read', 'context:write',
            'config:read', 'config:write',
            'rules:read', 'rules:write',
            'sync:push', 'sync:pull',
            'analytics:read', 'analytics:export',
            'admin:users', 'admin:roles',
        ],
        isBuiltIn: true,
    },
    {
        id: 'developer',
        name: 'Developer',
        description: 'Can read and write context, read config',
        permissions: [
            'context:read', 'context:write',
            'config:read',
            'rules:read',
            'sync:push', 'sync:pull',
            'analytics:read',
        ],
        isBuiltIn: true,
    },
    {
        id: 'viewer',
        name: 'Viewer',
        description: 'Read-only access',
        permissions: [
            'context:read',
            'config:read',
            'rules:read',
            'analytics:read',
        ],
        isBuiltIn: true,
    },
];

/**
 * RBAC Manager
 * Manages roles and user permissions
 */
export class RBACManager {
    private rbacDir: string;
    private rolesFile: string;
    private usersFile: string;
    private policiesFile: string;
    private roles: Map<string, Role> = new Map();
    private users: Map<string, User> = new Map();
    private policies: AccessPolicy[] = [];

    constructor(rootDir: string) {
        this.rbacDir = join(rootDir, '.contextos', 'rbac');
        this.rolesFile = join(this.rbacDir, 'roles.json');
        this.usersFile = join(this.rbacDir, 'users.json');
        this.policiesFile = join(this.rbacDir, 'policies.json');

        if (!existsSync(this.rbacDir)) {
            mkdirSync(this.rbacDir, { recursive: true });
        }

        this.loadData();
    }

    private loadData(): void {
        // Load built-in roles
        for (const role of BUILT_IN_ROLES) {
            this.roles.set(role.id, role);
        }

        // Load custom roles
        if (existsSync(this.rolesFile)) {
            try {
                const customRoles: Role[] = JSON.parse(readFileSync(this.rolesFile, 'utf-8'));
                for (const role of customRoles) {
                    this.roles.set(role.id, role);
                }
            } catch { /* ignore */ }
        }

        // Load users
        if (existsSync(this.usersFile)) {
            try {
                const users: User[] = JSON.parse(readFileSync(this.usersFile, 'utf-8'));
                for (const user of users) {
                    this.users.set(user.id, user);
                }
            } catch { /* ignore */ }
        }

        // Load policies
        if (existsSync(this.policiesFile)) {
            try {
                this.policies = JSON.parse(readFileSync(this.policiesFile, 'utf-8'));
            } catch { /* ignore */ }
        }
    }

    private saveRoles(): void {
        const customRoles = Array.from(this.roles.values()).filter(r => !r.isBuiltIn);
        writeFileSync(this.rolesFile, JSON.stringify(customRoles, null, 2), 'utf-8');
    }

    private saveUsers(): void {
        const users = Array.from(this.users.values());
        writeFileSync(this.usersFile, JSON.stringify(users, null, 2), 'utf-8');
    }

    /**
     * Create a new role
     */
    createRole(name: string, description: string, permissions: Permission[]): Role {
        const id = crypto.randomBytes(8).toString('hex');
        const role: Role = {
            id,
            name,
            description,
            permissions,
            isBuiltIn: false,
        };

        this.roles.set(id, role);
        this.saveRoles();
        return role;
    }

    /**
     * Get role by ID
     */
    getRole(roleId: string): Role | undefined {
        return this.roles.get(roleId);
    }

    /**
     * List all roles
     */
    listRoles(): Role[] {
        return Array.from(this.roles.values());
    }

    /**
     * Delete a custom role
     */
    deleteRole(roleId: string): boolean {
        const role = this.roles.get(roleId);
        if (!role || role.isBuiltIn) return false;

        this.roles.delete(roleId);
        this.saveRoles();
        return true;
    }

    /**
     * Create a new user
     */
    createUser(email: string, name: string, roles: string[] = ['viewer']): User {
        const id = crypto.randomBytes(8).toString('hex');
        const user: User = {
            id,
            email,
            name,
            roles,
            createdAt: new Date().toISOString(),
        };

        this.users.set(id, user);
        this.saveUsers();
        return user;
    }

    /**
     * Get user by ID
     */
    getUser(userId: string): User | undefined {
        return this.users.get(userId);
    }

    /**
     * Get user by email
     */
    getUserByEmail(email: string): User | undefined {
        return Array.from(this.users.values()).find(u => u.email === email);
    }

    /**
     * List all users
     */
    listUsers(): User[] {
        return Array.from(this.users.values());
    }

    /**
     * Assign role to user
     */
    assignRole(userId: string, roleId: string): boolean {
        const user = this.users.get(userId);
        const role = this.roles.get(roleId);

        if (!user || !role) return false;
        if (user.roles.includes(roleId)) return true;

        user.roles.push(roleId);
        this.saveUsers();
        return true;
    }

    /**
     * Remove role from user
     */
    removeRole(userId: string, roleId: string): boolean {
        const user = this.users.get(userId);
        if (!user) return false;

        user.roles = user.roles.filter(r => r !== roleId);
        this.saveUsers();
        return true;
    }

    /**
     * Get all permissions for a user
     */
    getUserPermissions(userId: string): Permission[] {
        const user = this.users.get(userId);
        if (!user) return [];

        const permissions = new Set<Permission>();
        for (const roleId of user.roles) {
            const role = this.roles.get(roleId);
            if (role) {
                for (const perm of role.permissions) {
                    permissions.add(perm);
                }
            }
        }

        return Array.from(permissions);
    }

    /**
     * Check if user has permission
     */
    hasPermission(userId: string, permission: Permission): boolean {
        const permissions = this.getUserPermissions(userId);
        return permissions.includes(permission);
    }

    /**
     * Check if user can access resource
     */
    canAccess(userId: string, resource: string): boolean {
        const policy = this.policies.find(p => p.resource === resource);
        if (!policy) return true; // No policy = open access

        const userPermissions = this.getUserPermissions(userId);
        return policy.requiredPermissions.every(p => userPermissions.includes(p));
    }

    /**
     * Update user activity timestamp
     */
    updateActivity(userId: string): void {
        const user = this.users.get(userId);
        if (user) {
            user.lastActive = new Date().toISOString();
            this.saveUsers();
        }
    }

    /**
     * Delete user
     */
    deleteUser(userId: string): boolean {
        const deleted = this.users.delete(userId);
        if (deleted) this.saveUsers();
        return deleted;
    }
}

export default RBACManager;
