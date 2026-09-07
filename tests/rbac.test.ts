import { describe, expect, it } from "vitest";
import type { Context } from "koa";
import { requirePermission } from "../src/middlewares/rbac.middleware.js";
import { store } from "../src/mocks/in-memory-store.js";
import { getPermissionsForRole, hasPermission } from "../src/utils/rbac.js";

describe("rbac", () => {
  it("grants admin dashboard permissions to admin role", () => {
    expect(hasPermission("admin", "admin:read")).toBe(true);
    expect(hasPermission("admin", "admin:dashboard:read")).toBe(true);
    expect(hasPermission("admin", "admin:users:write")).toBe(true);
    expect(getPermissionsForRole("admin")).toContain("admin:audit-logs:read");
  });

  it("keeps regular users out of admin permissions", () => {
    expect(hasPermission("user", "admin:read")).toBe(false);
    expect(getPermissionsForRole("user")).toEqual(["auth:read", "chat:write", "files:write", "feedback:write"]);
  });

  it("allows middleware calls when role has the requested permission", async () => {
    let called = false;
    const middleware = requirePermission("admin:files:read");
    const ctx = { state: { user: { id: 1, role: "admin" } } } as Context;

    await middleware(ctx, async () => {
      called = true;
    });

    expect(called).toBe(true);
  });

  it("rejects middleware calls when role lacks the requested permission", async () => {
    store.auditLogs.length = 0;
    store.nextAuditLogId = 1;
    const middleware = requirePermission("admin:users:read");
    const ctx = {
      ip: "127.0.0.1",
      get() {
        return "";
      },
      state: { user: { id: 2, role: "user" } }
    } as unknown as Context;

    await expect(middleware(ctx, async () => undefined)).rejects.toMatchObject({
      code: "AUTH_403",
      message: "Permission denied"
    });
    expect(store.auditLogs[0]).toMatchObject({
      userId: 2,
      action: "rbac_permission_denied",
      targetType: "permission",
      riskLevel: "medium",
      status: "blocked",
      errorCode: "AUTH_403"
    });
  });
});
