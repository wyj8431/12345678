import { env } from "../config/env.js";
import { store } from "../mocks/in-memory-store.js";
import { AppError } from "../utils/errors.js";
import { embeddingProvider } from "./embedding.provider.js";

export type VectorChunkMetadata = {
  userId: number;
  fileId: number;
  fileName: string;
  pageNumber?: number;
  chunkIndex: number;
};

export type VectorSearchHit = {
  id: string;
  document: string;
  metadata: VectorChunkMetadata;
  score: number;
  distance?: number;
};

export type VectorSearchInput = {
  userId: number;
  query: string;
  fileIds?: number[];
  topK: number;
  scoreThreshold: number;
};

export type VectorSearchProvider = {
  search(input: VectorSearchInput): Promise<VectorSearchHit[]>;
  upsertChunks(chunks: VectorChunkUpsertInput[]): Promise<void>;
  deleteByFile(input: { userId: number; fileId: number }): Promise<void>;
};

export type VectorChunkUpsertInput = {
  id: string;
  userId: number;
  fileId: number;
  fileName: string;
  document: string;
  embedding: number[];
  pageNumber?: number;
  chunkIndex: number;
};

export const vectorSearchProvider: VectorSearchProvider = {
  async search(input) {
    if (env.VECTOR_PROVIDER === "chroma") {
      return chromaVectorSearchProvider.search(input);
    }

    return mockVectorSearchProvider.search(input);
  },

  async upsertChunks(chunks) {
    if (env.VECTOR_PROVIDER === "chroma") {
      await chromaVectorSearchProvider.upsertChunks(chunks);
      return;
    }

    await mockVectorSearchProvider.upsertChunks(chunks);
  },

  async deleteByFile(input) {
    if (env.VECTOR_PROVIDER === "chroma") {
      await chromaVectorSearchProvider.deleteByFile(input);
      return;
    }

    await mockVectorSearchProvider.deleteByFile(input);
  }
};

export const mockVectorSearchProvider: VectorSearchProvider = {
  async search(input) {
    const chunkHits = store.vectorChunks
      .filter((chunk) => {
        if (chunk.userId !== input.userId) return false;
        if (input.fileIds?.length) return input.fileIds.includes(chunk.fileId);
        return true;
      })
      .map((chunk) => ({
        id: chunk.id,
        document: chunk.document,
        metadata: {
          userId: chunk.userId,
          fileId: chunk.fileId,
          fileName: chunk.fileName,
          pageNumber: chunk.pageNumber,
          chunkIndex: chunk.chunkIndex
        },
        score: scoreMockChunk(input.query, chunk.document),
        distance: 1 - scoreMockChunk(input.query, chunk.document)
      }))
      .filter((hit) => hit.score >= input.scoreThreshold)
      .sort((left, right) => right.score - left.score)
      .slice(0, input.topK);

    if (chunkHits.length > 0) return chunkHits;
    if (input.fileIds?.length) return [];
    if (!input.query.includes("智枢")) return [];

    const fallbackFileId = input.fileIds?.[0] ?? 1;
    return [
      {
        id: `mock:${input.userId}:${fallbackFileId}:0`,
        document: "智枢AI是多模态私有化AI智能知识库问答平台，核心包含RAG、Agent、文件入库、SSE流式返回和大模型兜底。",
        metadata: {
          userId: input.userId,
          fileId: fallbackFileId,
          fileName: "智枢AI产品PRD文档_完善版.docx",
          pageNumber: 1,
          chunkIndex: 0
        },
        score: 0.91,
        distance: 0.09
      }
    ].filter((hit) => hit.score >= input.scoreThreshold);
  },

  async upsertChunks(chunks) {
    for (const chunk of chunks) {
      const existingIndex = store.vectorChunks.findIndex((item) => item.id === chunk.id);
      const nextChunk = {
        ...chunk,
        createdAt: new Date().toISOString()
      };

      if (existingIndex >= 0) {
        store.vectorChunks[existingIndex] = nextChunk;
      } else {
        store.vectorChunks.push(nextChunk);
      }
    }
  },

  async deleteByFile(input) {
    store.vectorChunks = store.vectorChunks.filter(
      (chunk) => !(chunk.userId === input.userId && chunk.fileId === input.fileId)
    );
  }
};

const chromaVectorSearchProvider: VectorSearchProvider = {
  async search(input) {
    const queryEmbedding = await embeddingProvider.embedQuery(input.query);
    const response = await fetch(buildChromaQueryUrl(), {
      method: "POST",
      headers: buildChromaHeaders(),
      body: JSON.stringify({
        query_embeddings: [queryEmbedding],
        n_results: input.topK,
        where: buildChromaWhere(input.userId, input.fileIds),
        include: ["documents", "metadatas", "distances"]
      })
    });

    if (!response.ok) {
      throw new AppError("CHROMA_QUERY_FAILED", `Chroma query failed with status ${response.status}`, 502);
    }

    const data = (await response.json()) as ChromaQueryResponse;
    return mapChromaResponse(data, input.userId, input.scoreThreshold);
  },

  async upsertChunks(chunks) {
    if (chunks.length === 0) return;

    const response = await fetch(buildChromaRecordUrl("upsert"), {
      method: "POST",
      headers: buildChromaHeaders(),
      body: JSON.stringify({
        ids: chunks.map((chunk) => chunk.id),
        documents: chunks.map((chunk) => chunk.document),
        embeddings: chunks.map((chunk) => chunk.embedding),
        metadatas: chunks.map((chunk) => ({
          user_id: chunk.userId,
          file_id: chunk.fileId,
          file_name: chunk.fileName,
          page_number: chunk.pageNumber ?? null,
          chunk_index: chunk.chunkIndex
        }))
      })
    });

    if (!response.ok) {
      throw new AppError("CHROMA_UPSERT_FAILED", `Chroma upsert failed with status ${response.status}`, 502);
    }
  },

  async deleteByFile(input) {
    const response = await fetch(buildChromaRecordUrl("delete"), {
      method: "POST",
      headers: buildChromaHeaders(),
      body: JSON.stringify({
        where: buildChromaWhere(input.userId, [input.fileId])
      })
    });

    if (!response.ok) {
      throw new AppError("CHROMA_DELETE_FAILED", `Chroma delete failed with status ${response.status}`, 502);
    }
  }
};

function buildChromaQueryUrl() {
  return buildChromaRecordUrl("query");
}

function buildChromaRecordUrl(action: "query" | "upsert" | "delete") {
  const baseUrl = env.CHROMA_BASE_URL.replace(/\/$/, "");
  return `${baseUrl}/api/v2/tenants/${encodeURIComponent(env.CHROMA_TENANT)}/databases/${encodeURIComponent(
    env.CHROMA_DATABASE
  )}/collections/${encodeURIComponent(env.CHROMA_COLLECTION_ID)}/${action}`;
}

function buildChromaHeaders() {
  const headers: Record<string, string> = {
    "Content-Type": "application/json"
  };
  if (env.CHROMA_TOKEN) {
    headers["x-chroma-token"] = env.CHROMA_TOKEN;
  }
  return headers;
}

function scoreMockChunk(query: string, document: string) {
  if (document.includes(query) || query.includes("智枢") || document.includes("智枢")) return 0.91;
  return 0.5;
}

function buildChromaWhere(userId: number, fileIds?: number[]) {
  const userFilter = { user_id: { $eq: userId } };
  if (!fileIds?.length) return userFilter;

  return {
    $and: [userFilter, { file_id: { $in: fileIds } }]
  };
}

type ChromaQueryResponse = {
  ids?: string[][];
  documents?: (string | null)[][];
  metadatas?: (Record<string, unknown> | null)[][];
  distances?: number[][];
};

function mapChromaResponse(data: ChromaQueryResponse, userId: number, scoreThreshold: number): VectorSearchHit[] {
  const ids = data.ids?.[0] ?? [];
  const documents = data.documents?.[0] ?? [];
  const metadatas = data.metadatas?.[0] ?? [];
  const distances = data.distances?.[0] ?? [];

  return ids
    .map((id, index) => {
      const metadata = parseMetadata(metadatas[index]);
      const distance = distances[index];
      const score = typeof distance === "number" ? Math.max(0, Math.min(1, 1 - distance)) : 0;
      return {
        id,
        document: documents[index] ?? "",
        metadata,
        score,
        distance
      };
    })
    .filter((hit) => hit.metadata.userId === userId && hit.score >= scoreThreshold);
}

function parseMetadata(metadata: Record<string, unknown> | null | undefined): VectorChunkMetadata {
  const fileId = Number(metadata?.file_id ?? metadata?.fileId ?? 0);
  const userId = Number(metadata?.user_id ?? metadata?.userId ?? 0);
  const pageNumber = metadata?.page_number ?? metadata?.pageNumber;

  return {
    userId,
    fileId,
    fileName: String(metadata?.file_name ?? metadata?.fileName ?? "unknown"),
    pageNumber: typeof pageNumber === "number" ? pageNumber : undefined,
    chunkIndex: Number(metadata?.chunk_index ?? metadata?.chunkIndex ?? 0)
  };
}
