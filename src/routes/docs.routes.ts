import Router from "@koa/router";
import { docsService } from "../services/docs.service.js";

export const docsRouter = new Router();

docsRouter.get("/openapi.json", async (ctx) => {
  ctx.set("Cache-Control", "no-cache");
  ctx.body = await docsService.getOpenApiSpec();
});

docsRouter.get("/docs", (ctx) => {
  ctx.set("Content-Type", "text/html; charset=utf-8");
  ctx.body = docsService.getDocsHtml();
});
