import Router from "@koa/router";
import { mockAuthMiddleware } from "../middlewares/mock-auth.middleware.js";
import { authLoginSchema } from "../schemas/auth.schema.js";
import { auditService } from "../services/audit.service.js";
import { authService } from "../services/auth.service.js";
import { AppError } from "../utils/errors.js";

export const authRouter = new Router({ prefix: "/api/auth" });

authRouter.post("/login", async (ctx) => {
  const request = authLoginSchema.parse(ctx.request.body);
  try {
    const data = await authService.login(request);
    await auditService.record({
      userId: data.user.id,
      action: "auth_login",
      targetType: "auth",
      riskLevel: "low",
      status: "success",
      ctx
    });
    ctx.body = { success: true, data };
  } catch (error) {
    await auditService.record({
      action: "auth_login",
      targetType: "auth",
      riskLevel: error instanceof AppError && error.status === 403 ? "high" : "medium",
      status: error instanceof AppError && error.status === 403 ? "blocked" : "failed",
      errorCode: error instanceof AppError ? error.code : "AUTH_LOGIN_FAILED",
      ctx
    });
    throw error;
  }
});

authRouter.get("/me", mockAuthMiddleware, async (ctx) => {
  ctx.body = {
    success: true,
    data: await authService.getCurrentUser({
      userId: ctx.state.user.id,
      role: ctx.state.user.role
    })
  };
});

authRouter.post("/logout", mockAuthMiddleware, async (ctx) => {
  await auditService.record({
    userId: ctx.state.user.id,
    action: "auth_logout",
    targetType: "auth",
    riskLevel: "low",
    status: "success",
    ctx
  });

  ctx.body = {
    success: true,
    data: {
      loggedOut: true
    }
  };
});
