import { auditService } from "./audit.service.js";
import { AppError } from "../utils/errors.js";

const blockedPatterns = [
  "ignore previous instructions",
  "bypass permission",
  "dump all users",
  "export all users",
  "绕过权限",
  "导出所有用户",
  "泄露密钥",
  "删除所有用户"
];

export const safetyService = {
  async assertQuestionAllowed(input: { userId: number; content: string }) {
    const normalized = input.content.toLowerCase();
    const matchedPattern = blockedPatterns.find((pattern) => normalized.includes(pattern.toLowerCase()));

    if (matchedPattern) {
      await writeAuditLog({
        userId: input.userId,
        riskLevel: "high",
        status: "blocked",
        errorCode: "SAFETY_BLOCKED"
      });
      throw new AppError("SAFETY_BLOCKED", "Input was blocked by safety policy", 400);
    }

    await writeAuditLog({
      userId: input.userId,
      riskLevel: "low",
      status: "success"
    });
  }
};

async function writeAuditLog(input: {
  userId: number;
  riskLevel: "low" | "medium" | "high";
  status: "success" | "blocked" | "failed";
  errorCode?: string;
}) {
  await auditService.record({
    userId: input.userId,
    action: "chat_safety_check",
    targetType: "message",
    riskLevel: input.riskLevel,
    status: input.status,
    errorCode: input.errorCode
  });
}
