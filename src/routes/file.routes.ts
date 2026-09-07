import Router from "@koa/router";
import { fileCompleteSchema, fileInitSchema } from "../schemas/file.schema.js";
import { fileService } from "../services/file.service.js";

export const fileRouter = new Router({ prefix: "/api/files" });

fileRouter.post("/init", async (ctx) => {
  const request = fileInitSchema.parse(ctx.request.body);
  ctx.body = { success: true, data: await fileService.initUpload(ctx.state.user.id, request) };
});

fileRouter.post("/complete", async (ctx) => {
  const request = fileCompleteSchema.parse(ctx.request.body);
  ctx.body = { success: true, data: await fileService.completeUpload(ctx.state.user.id, request) };
});

fileRouter.get("/", async (ctx) => {
  ctx.body = { success: true, data: await fileService.listFiles(ctx.state.user.id) };
});

fileRouter.delete("/:id", async (ctx) => {
  const fileId = Number(ctx.params.id);
  ctx.body = { success: true, data: await fileService.deleteFile(ctx.state.user.id, fileId) };
});
