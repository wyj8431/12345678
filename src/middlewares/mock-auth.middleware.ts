import type { Context, Next } from "koa";
import { env } from "../config/env.js";
import { auditService } from "../services/audit.service.js";
import { AppError } from "../utils/errors.js";
import { verifyJwt } from "../utils/jwt.js";
import { hasPermission } from "../utils/rbac.js";

async function getBearerToken(ctx: Context) {
  const authorization = ctx.get("authorization");
  if (!authorization) return null;

  const [scheme, token] = authorization.split(" ");
  if (scheme !== "Bearer" || !token) {
    await auditService.record({
      action: "auth_authorization_header",
      targetType: "auth",
      riskLevel: "medium",
      status: "failed",
      errorCode: "AUTH_401",
      ctx
    });
    throw new AppError("AUTH_401", "Invalid authorization header", 401);
  }
  return token;
}

export async function mockAuthMiddleware(ctx: Context, next: Next) {
  const token = await getBearerToken(ctx);
  if (token) {
    let payload: ReturnType<typeof verifyJwt>;
    try {
      payload = verifyJwt(token);
    } catch (error) {
      await auditService.record({
        action: "auth_token_verify",
        targetType: "auth",
        riskLevel: "medium",
        status: "failed",
        errorCode: error instanceof AppError ? error.code : "AUTH_401",
        ctx
      });
      throw error;
    }
    ctx.state.user = {
      id: Number(payload.sub),
      role: payload.role
    };
    await next();
    return;
  }

  if (!env.USE_MOCK_DB) {
    await auditService.record({
      action: "auth_required",
      targetType: "auth",
      riskLevel: "medium",
      status: "failed",
      errorCode: "AUTH_401",
      ctx
    });
    throw new AppError("AUTH_401", "Authentication required", 401);
  }

  ctx.state.user = {
    id: env.DEFAULT_USER_ID,
    role: env.DEFAULT_USER_ROLE
  };
  await next();
}

export async function adminOnlyMiddleware(ctx: Context, next: Next) {
  if (!ctx.state.user || !hasPermission(ctx.state.user.role, "admin:read")) {
    await auditService.record({
      userId: ctx.state.user?.id,
      action: "rbac_permission_denied",
      targetType: "permission",
      riskLevel: "medium",
      status: "blocked",
      errorCode: "AUTH_403",
      ctx
    });
    throw new AppError("AUTH_403", "Admin permission required", 403);
  }
  await next();
}
