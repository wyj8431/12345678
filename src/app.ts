import cors from "@koa/cors";
import Koa from "koa";
import { koaBody } from "koa-body";
import { errorMiddleware } from "./middlewares/error.middleware.js";
import { requestLoggerMiddleware } from "./middlewares/request-logger.middleware.js";
import { router } from "./routes/index.js";

export function createApp() {
  const app = new Koa();

  app.use(errorMiddleware);
  app.use(requestLoggerMiddleware);
  app.use(cors());
  app.use(koaBody({ multipart: true, jsonLimit: "2mb" }));
  app.use(router.routes());
  app.use(router.allowedMethods());

  return app;
}
