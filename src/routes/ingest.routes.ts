import Router from "@koa/router";
import { fileService } from "../services/file.service.js";

export const ingestRouter = new Router({ prefix: "/api/ingest-tasks" });

ingestRouter.get("/:id", async (ctx) => {
  const taskId = Number(ctx.params.id);
  ctx.body = { success: true, data: await fileService.getTask(ctx.state.user.id, taskId) };
});
