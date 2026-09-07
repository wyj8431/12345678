import type { AuthPermission, AuthUserRole } from "../schemas/auth.schema.js";

export const rolePermissions: Record<AuthUserRole, AuthPermission[]> = {
  user: ["auth:read", "chat:write", "files:write", "feedback:write"],
  admin: [
    "auth:read",
    "chat:write",
    "files:write",
    "feedback:write",
    "admin:read",
    "admin:dashboard:read",
    "admin:users:read",
    "admin:users:write",
    "admin:ingest-tasks:read",
    "admin:model-logs:read",
    "admin:rag-logs:read",
    "admin:feedback:read",
    "admin:messages:read",
    "admin:conversations:read",
    "admin:files:read",
    "admin:audit-logs:read"
  ]
};

export function getPermissionsForRole(role: AuthUserRole) {
  return rolePermissions[role];
}

export function hasPermission(role: AuthUserRole, permission: AuthPermission) {
  return rolePermissions[role].includes(permission);
}
