import type { Context } from "koa";
import { env } from "../config/env.js";
import { store } from "../mocks/in-memory-store.js";
import { auditRepository } from "../repositories/audit.repository.js";

type AuditRecordInput = {
  userId?: number;
  action: string;
  targetType?: string;
  targetId?: number;
  riskLevel: "low" | "medium" | "high";
  status: "success" | "blocked" | "failed";
  errorCode?: string;
  ctx?: Context;
};

function requestMeta(ctx?: Context) {
  if (!ctx) return {};
  return {
    ip: ctx.ip,
    userAgent: ctx.get("user-agent") || undefined
  };
}

export const auditService = {
  async record(input: AuditRecordInput) {
    const meta = requestMeta(input.ctx);

    if (env.USE_MOCK_DB) {
      store.auditLogs.push({
        id: store.nextAuditLogId++,
        userId: input.userId,
        action: input.action,
        targetType: input.targetType,
        targetId: input.targetId,
        riskLevel: input.riskLevel,
        status: input.status,
        errorCode: input.errorCode,
        ip: meta.ip,
        userAgent: meta.userAgent,
        createdAt: new Date().toISOString()
      });
      return;
    }

    await auditRepository.create({
      userId: input.userId,
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId,
      riskLevel: input.riskLevel,
      status: input.status,
      errorCode: input.errorCode,
      ip: meta.ip,
      userAgent: meta.userAgent
    });
  }
};
