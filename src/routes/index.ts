import Router from "@koa/router";
import { mockAuthMiddleware } from "../middlewares/mock-auth.middleware.js";
import { healthService } from "../services/health.service.js";
import { adminRouter } from "./admin.routes.js";
import { authRouter } from "./auth.routes.js";
import { chatRouter } from "./chat.routes.js";
import { docsRouter } from "./docs.routes.js";
import { feedbackRouter } from "./feedback.routes.js";
import { fileRouter } from "./file.routes.js";
import { ingestRouter } from "./ingest.routes.js";

export const router = new Router();

router.get("/health", (ctx) => {
  ctx.body = { success: true, data: { status: "ok" } };
});

router.get("/ready", async (ctx) => {
  const readiness = await healthService.getReadiness();
  ctx.status = readiness.status === "ready" ? 200 : 503;
  ctx.body = { success: readiness.status === "ready", data: readiness };
});

router.use(docsRouter.routes(), docsRouter.allowedMethods());
router.use(authRouter.routes(), authRouter.allowedMethods());

router.use(mockAuthMiddleware);
router.use(chatRouter.routes(), chatRouter.allowedMethods());
router.use(fileRouter.routes(), fileRouter.allowedMethods());
router.use(ingestRouter.routes(), ingestRouter.allowedMethods());
router.use(feedbackRouter.routes(), feedbackRouter.allowedMethods());
router.use(adminRouter.routes(), adminRouter.allowedMethods());
