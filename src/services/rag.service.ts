import { env } from "../config/env.js";
import { store } from "../mocks/in-memory-store.js";
import { vectorSearchProvider } from "../providers/vector-search.provider.js";
import { telemetryRepository } from "../repositories/telemetry.repository.js";
import type { ChatReference } from "../schemas/chat.schema.js";

type RagSearchResult = {
  context: string;
  references: ChatReference[];
};

export const ragService = {
  async search(input: {
    userId: number;
    query: string;
    fileIds?: number[];
    conversationId?: number;
    messageId?: number;
  }): Promise<RagSearchResult> {
    const startedAt = Date.now();
    const hits = await vectorSearchProvider.search({
      userId: input.userId,
      query: input.query,
      fileIds: input.fileIds,
      topK: env.RAG_TOP_K,
      scoreThreshold: env.RAG_SCORE_THRESHOLD
    });
    const references = hits.map<ChatReference>((hit) => ({
      fileId: hit.metadata.fileId,
      fileName: hit.metadata.fileName,
      pageNumber: hit.metadata.pageNumber,
      chunkIndex: hit.metadata.chunkIndex,
      score: hit.score,
      quotePreview: hit.document.slice(0, 120)
    }));

    const latencyMs = Date.now() - startedAt;
    await writeRagLog({
      userId: input.userId,
      conversationId: input.conversationId,
      messageId: input.messageId,
      query: input.query,
      hitCount: references.length,
      maxScore: references[0]?.score,
      usedFallback: references.length === 0,
      latencyMs
    });

    return {
      context: hits.map((hit) => hit.document).join("\n\n"),
      references
    };
  },

  getConfig() {
    return {
      topK: env.RAG_TOP_K,
      scoreThreshold: env.RAG_SCORE_THRESHOLD,
      vectorProvider: env.VECTOR_PROVIDER
    };
  }
};

async function writeRagLog(input: {
  userId: number;
  conversationId?: number;
  messageId?: number;
  query: string;
  hitCount: number;
  maxScore?: number;
  usedFallback: boolean;
  latencyMs: number;
}) {
  if (env.USE_MOCK_DB) {
    store.ragQueryLogs.push({
      id: store.nextRagQueryLogId++,
      userId: input.userId,
      conversationId: input.conversationId,
      messageId: input.messageId,
      query: input.query,
      topK: env.RAG_TOP_K,
      thresholdValue: env.RAG_SCORE_THRESHOLD,
      hitCount: input.hitCount,
      maxScore: input.maxScore,
      usedFallback: input.usedFallback,
      latencyMs: input.latencyMs,
      createdAt: new Date().toISOString()
    });
    return;
  }

  await telemetryRepository.createRagQueryLog(input).catch(() => undefined);
}
