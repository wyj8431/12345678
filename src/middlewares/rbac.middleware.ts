import type { Context, Next } from "koa";
import type { AuthPermission } from "../schemas/auth.schema.js";
import { auditService } from "../services/audit.service.js";
import { AppError } from "../utils/errors.js";
import { hasPermission } from "../utils/rbac.js";

export function requirePermission(permission: AuthPermission) {
  return async (ctx: Context, next: Next) => {
    const user = ctx.state.user;
    if (!user || !hasPermission(user.role, permission)) {
      await auditService.record({
        userId: user?.id,
        action: "rbac_permission_denied",
        targetType: "permission",
        riskLevel: "medium",
        status: "blocked",
        errorCode: "AUTH_403",
        ctx
      });
      throw new AppError("AUTH_403", "Permission denied", 403);
    }

    await next();
  };
}
