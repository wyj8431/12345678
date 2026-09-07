import { z } from "zod";

export const authLoginSchema = z.object({
  username: z.string().trim().min(1).max(64),
  password: z.string().min(8).max(128)
});

export type AuthLoginRequest = z.infer<typeof authLoginSchema>;

export type AuthUserRole = "user" | "admin";
export type AuthUserStatus = "active" | "disabled";
export type AuthPermission =
  | "auth:read"
  | "chat:write"
  | "files:write"
  | "feedback:write"
  | "admin:read"
  | "admin:dashboard:read"
  | "admin:users:read"
  | "admin:users:write"
  | "admin:ingest-tasks:read"
  | "admin:model-logs:read"
  | "admin:rag-logs:read"
  | "admin:feedback:read"
  | "admin:messages:read"
  | "admin:conversations:read"
  | "admin:files:read"
  | "admin:audit-logs:read";

export type AuthUser = {
  id: number;
  username: string;
  role: AuthUserRole;
  status: AuthUserStatus;
  permissions: AuthPermission[];
};

export type AuthLoginResponse = {
  accessToken: string;
  tokenType: "Bearer";
  expiresAt: string;
  user: AuthUser;
};

export type AuthMeResponse = {
  user: AuthUser;
};

export type AuthLogoutResponse = {
  loggedOut: true;
};
