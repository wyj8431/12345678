import { beforeEach, describe, expect, it } from "vitest";
import { store } from "../src/mocks/in-memory-store.js";
import { mockVectorSearchProvider } from "../src/providers/vector-search.provider.js";

describe("mockVectorSearchProvider", () => {
  beforeEach(() => {
    store.files.length = 0;
    store.vectorChunks.length = 0;
    store.nextFileId = 1;
  });

  it("returns a default Zhishu hit for product queries", async () => {
    const hits = await mockVectorSearchProvider.search({
      userId: 1,
      query: "智枢AI是什么？",
      topK: 8,
      scoreThreshold: 0.75
    });

    expect(hits).toHaveLength(1);
    expect(hits[0]?.metadata.userId).toBe(1);
    expect(hits[0]?.metadata.fileName).toBe("智枢AI产品PRD文档_完善版.docx");
  });

  it("uses only chunks owned by the current user", async () => {
    await mockVectorSearchProvider.upsertChunks([
      {
        id: "file:2:1:0",
        userId: 2,
        fileId: 1,
        fileName: "other-user.txt",
        document: "合同问题答案来自其他用户",
        embedding: [1, 0],
        chunkIndex: 0
      },
      {
        id: "file:1:2:0",
        userId: 1,
        fileId: 2,
        fileName: "owned.txt",
        document: "合同问题答案来自当前用户",
        embedding: [0, 1],
        chunkIndex: 0
      }
    ]);

    const hits = await mockVectorSearchProvider.search({
      userId: 1,
      query: "合同问题",
      topK: 8,
      scoreThreshold: 0.75
    });

    expect(hits).toHaveLength(1);
    expect(hits[0]?.metadata.fileId).toBe(2);
    expect(hits[0]?.metadata.fileName).toBe("owned.txt");
  });

  it("deletes chunks by user and file", async () => {
    await mockVectorSearchProvider.upsertChunks([
      {
        id: "file:1:1:0",
        userId: 1,
        fileId: 1,
        fileName: "owned.txt",
        document: "智枢AI文档",
        embedding: [1],
        chunkIndex: 0
      }
    ]);

    await mockVectorSearchProvider.deleteByFile({ userId: 1, fileId: 1 });

    expect(store.vectorChunks).toHaveLength(0);
  });

  it("filters hits below the configured score threshold", async () => {
    const hits = await mockVectorSearchProvider.search({
      userId: 1,
      query: "智枢AI是什么？",
      topK: 8,
      scoreThreshold: 0.95
    });

    expect(hits).toHaveLength(0);
  });

  it("does not return a default product hit when fileIds are explicitly scoped", async () => {
    const hits = await mockVectorSearchProvider.search({
      userId: 1,
      query: "智枢AI是什么？",
      fileIds: [99],
      topK: 8,
      scoreThreshold: 0.75
    });

    expect(hits).toHaveLength(0);
  });
});
