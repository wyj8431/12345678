import type { Context, Next } from "koa";
import { ZodError } from "zod";
import { AppError } from "../utils/errors.js";
import { logger } from "../utils/logger.js";

export async function errorMiddleware(ctx: Context, next: Next) {
  try {
    await next();
  } catch (error) {
    if (error instanceof ZodError) {
      ctx.status = 400;
      ctx.body = {
        success: false,
        error: { code: "VALIDATION_001", message: "参数错误" }
      };
      return;
    }

    if (error instanceof AppError) {
      ctx.status = error.status;
      ctx.body = {
        success: false,
        error: { code: error.code, message: error.message }
      };
      return;
    }

    logger.error({ error }, "request failed");
    ctx.status = 500;
    ctx.body = {
      success: false,
      error: { code: "UNKNOWN_ERROR", message: "服务异常，请稍后重试" }
    };
  }
}
