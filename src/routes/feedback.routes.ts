import Router from "@koa/router";
import { feedbackCreateSchema } from "../schemas/feedback.schema.js";
import { feedbackService } from "../services/feedback.service.js";

export const feedbackRouter = new Router({ prefix: "/api/feedback" });

feedbackRouter.post("/", async (ctx) => {
  const request = feedbackCreateSchema.parse(ctx.request.body);
  ctx.body = { success: true, data: await feedbackService.create(ctx.state.user.id, request) };
});
