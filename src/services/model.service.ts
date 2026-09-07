import { env } from "../config/env.js";
import { store } from "../mocks/in-memory-store.js";
import { telemetryRepository } from "../repositories/telemetry.repository.js";

export const modelService = {
  async *streamAnswer(input: {
    userId: number;
    conversationId?: number;
    query: string;
    context: string;
    useFallback: boolean;
    contextSource?: "knowledge_base" | "temporary_context";
    signal: AbortSignal;
  }): AsyncGenerator<string> {
    const startedAt = Date.now();
    const answer = input.useFallback
      ? `当前知识库没有检索到足够可靠的信息。针对你的问题：“${input.query}”，建议补充相关文件后再查询。`
      : input.contextSource === "temporary_context"
        ? `根据本次临时上下文，${input.context}`
      : `根据知识库内容，${input.context}`;

    for (const char of answer) {
      if (input.signal.aborted) {
        await writeModelLog({
          userId: input.userId,
          conversationId: input.conversationId,
          status: "aborted",
          latencyMs: Date.now() - startedAt
        });
        return;
      }

      yield char;
      await new Promise((resolve) => setTimeout(resolve, 10));
    }

    await writeModelLog({
      userId: input.userId,
      conversationId: input.conversationId,
      status: "success",
      latencyMs: Date.now() - startedAt
    });
  }
};

async function writeModelLog(input: {
  userId: number;
  conversationId?: number;
  status: "success" | "failed" | "timeout" | "aborted";
  latencyMs: number;
}) {
  if (env.USE_MOCK_DB) {
    store.modelCallLogs.push({
      id: store.nextModelCallLogId++,
      userId: input.userId,
      conversationId: input.conversationId,
      provider: "mock-model",
      purpose: "chat",
      status: input.status,
      latencyMs: input.latencyMs,
      createdAt: new Date().toISOString()
    });
    return;
  }

  await telemetryRepository
    .createModelCallLog({
      userId: input.userId,
      conversationId: input.conversationId,
      provider: "mock-model",
      purpose: "chat",
      status: input.status,
      latencyMs: input.latencyMs
    })
    .catch(() => undefined);
}
