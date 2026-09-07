import type { Context } from "koa";
import type { ChatReference } from "../schemas/chat.schema.js";
import type { AgentDecision } from "../services/agent.service.js";

export type SseEvent =
  | { type: "start"; conversationId: number; messageId: number }
  | { type: "progress"; stage: "safety" | "agent" | "retrieval" | "generation" }
  | { type: "agent_decision"; data: AgentDecision }
  | { type: "references"; data: ChatReference[] }
  | { type: "content"; delta: string }
  | { type: "error"; error: { code: string; message: string } }
  | { type: "done"; usage?: { latencyMs: number; provider?: string } };

export type SseWriter = {
  write(event: SseEvent): void;
  end(): void;
};

export function initSse(ctx: Context): SseWriter {
  ctx.status = 200;
  ctx.set("Content-Type", "text/event-stream; charset=utf-8");
  ctx.set("Cache-Control", "no-cache, no-transform");
  ctx.set("Connection", "keep-alive");
  ctx.respond = false;

  return {
    write(event) {
      ctx.res.write(`data: ${JSON.stringify(event)}\n\n`);
    },
    end() {
      ctx.res.end();
    }
  };
}
