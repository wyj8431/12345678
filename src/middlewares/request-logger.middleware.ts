import type { Context, Next } from "koa";
import { logger } from "../utils/logger.js";

export async function requestLoggerMiddleware(ctx: Context, next: Next) {
  const startedAt = Date.now();
  await next();
  logger.info(
    {
      method: ctx.method,
      path: ctx.path,
      status: ctx.status,
      latencyMs: Date.now() - startedAt
    },
    "request completed"
  );
}
