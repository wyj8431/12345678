import Router from "@koa/router";
import { chatStreamRequestSchema } from "../schemas/chat.schema.js";
import { chatService } from "../services/chat.service.js";
import { AppError } from "../utils/errors.js";
import { initSse } from "../utils/sse.js";

export const chatRouter = new Router({ prefix: "/api/chat" });

chatRouter.post("/stream", async (ctx) => {
  const request = chatStreamRequestSchema.parse(ctx.request.body);
  const sse = initSse(ctx);
  const abortController = new AbortController();

  ctx.req.on("close", () => abortController.abort());

  try {
    await chatService.streamAnswer({
      userId: ctx.state.user.id,
      request,
      sse,
      signal: abortController.signal
    });
  } catch (error) {
    if (error instanceof AppError) {
      sse.write({
        type: "error",
        error: { code: error.code, message: error.message }
      });
      return;
    }

    sse.write({
      type: "error",
      error: { code: "CHAT_STREAM_FAILED", message: "Chat stream failed" }
    });
  } finally {
    sse.end();
  }
});
