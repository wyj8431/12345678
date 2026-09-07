import { beforeEach, describe, expect, it } from "vitest";
import { store } from "../src/mocks/in-memory-store.js";
import { auditService } from "../src/services/audit.service.js";

describe("auditService", () => {
  beforeEach(() => {
    store.auditLogs.length = 0;
    store.nextAuditLogId = 1;
  });

  it("records a safe mock audit log without sensitive payloads", async () => {
    await auditService.record({
      userId: 1,
      action: "auth_login",
      targetType: "auth",
      riskLevel: "low",
      status: "success"
    });

    expect(store.auditLogs).toEqual([
      {
        id: 1,
        userId: 1,
        action: "auth_login",
        targetType: "auth",
        targetId: undefined,
        riskLevel: "low",
        status: "success",
        errorCode: undefined,
        ip: undefined,
        userAgent: undefined,
        createdAt: expect.any(String)
      }
    ]);
    expect(store.auditLogs[0]).not.toHaveProperty("password");
    expect(store.auditLogs[0]).not.toHaveProperty("token");
  });

  it("supports anonymous failed auth audit logs", async () => {
    await auditService.record({
      action: "auth_login",
      targetType: "auth",
      riskLevel: "medium",
      status: "failed",
      errorCode: "AUTH_401"
    });

    expect(store.auditLogs[0]).toMatchObject({
      userId: undefined,
      action: "auth_login",
      status: "failed",
      errorCode: "AUTH_401"
    });
  });
});
