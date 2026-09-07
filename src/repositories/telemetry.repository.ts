import { env } from "../config/env.js";
import { mysqlPool } from "../providers/mysql.provider.js";

export const telemetryRepository = {
  async createModelCallLog(input: {
    userId: number;
    conversationId?: number;
    provider: string;
    purpose: "chat" | "rewrite_query" | "summarize" | "embedding" | "safety";
    status: "success" | "failed" | "timeout" | "aborted";
    latencyMs?: number;
    tokenInput?: number;
    tokenOutput?: number;
    errorCode?: string;
  }) {
    await mysqlPool.execute(
      `INSERT INTO model_call_logs
       (user_id, conversation_id, provider, purpose, status, latency_ms, token_input, token_output, error_code)
       VALUES
       (:userId, :conversationId, :provider, :purpose, :status, :latencyMs, :tokenInput, :tokenOutput, :errorCode)`,
      {
        userId: input.userId,
        conversationId: input.conversationId ?? null,
        provider: input.provider,
        purpose: input.purpose,
        status: input.status,
        latencyMs: input.latencyMs ?? null,
        tokenInput: input.tokenInput ?? null,
        tokenOutput: input.tokenOutput ?? null,
        errorCode: input.errorCode ?? null
      }
    );
  },

  async createRagQueryLog(input: {
    userId: number;
    conversationId?: number;
    messageId?: number;
    query: string;
    hitCount: number;
    maxScore?: number;
    usedFallback: boolean;
    latencyMs: number;
  }) {
    await mysqlPool.execute(
      `INSERT INTO rag_query_logs
       (user_id, conversation_id, message_id, query, top_k, threshold_value, hit_count, max_score, used_fallback, latency_ms)
       VALUES
       (:userId, :conversationId, :messageId, :query, :topK, :thresholdValue, :hitCount, :maxScore, :usedFallback, :latencyMs)`,
      {
        userId: input.userId,
        conversationId: input.conversationId ?? null,
        messageId: input.messageId ?? null,
        query: input.query,
        topK: env.RAG_TOP_K,
        thresholdValue: env.RAG_SCORE_THRESHOLD,
        hitCount: input.hitCount,
        maxScore: input.maxScore ?? null,
        usedFallback: input.usedFallback,
        latencyMs: input.latencyMs
      }
    );
  }
};
