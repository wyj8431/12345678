import { mysqlPool } from "../providers/mysql.provider.js";

export const auditRepository = {
  async create(input: {
    userId?: number;
    action: string;
    targetType?: string;
    targetId?: number;
    riskLevel: "low" | "medium" | "high";
    status: "success" | "blocked" | "failed";
    errorCode?: string;
    ip?: string;
    userAgent?: string;
  }) {
    await mysqlPool.execute(
      `INSERT INTO audit_logs
       (user_id, action, target_type, target_id, risk_level, status, error_code, ip, user_agent)
       VALUES
       (:userId, :action, :targetType, :targetId, :riskLevel, :status, :errorCode, :ip, :userAgent)`,
      {
        userId: input.userId ?? null,
        action: input.action,
        targetType: input.targetType ?? null,
        targetId: input.targetId ?? null,
        riskLevel: input.riskLevel,
        status: input.status,
        errorCode: input.errorCode ?? null,
        ip: input.ip ?? null,
        userAgent: input.userAgent ?? null
      }
    );
  }
};
