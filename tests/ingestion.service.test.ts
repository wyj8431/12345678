import { beforeEach, describe, expect, it } from "vitest";
import { store } from "../src/mocks/in-memory-store.js";
import { ingestionService } from "../src/services/ingestion.service.js";

describe("ingestionService", () => {
  beforeEach(() => {
    store.files.length = 0;
    store.tasks.length = 0;
    store.vectorChunks.length = 0;
  });

  it("runs the mock ingestion pipeline and upserts searchable chunks", async () => {
    store.files.push({
      id: 1,
      userId: 1,
      fileName: "prd.txt",
      fileSize: 1024,
      fileType: "txt",
      checksum: "abc",
      ingestMode: "permanent",
      status: "processing",
      createdAt: new Date().toISOString()
    });
    store.tasks.push({
      id: 1,
      userId: 1,
      fileId: 1,
      taskType: "file",
      status: "pending",
      progress: 0,
      createdAt: new Date().toISOString()
    });

    await ingestionService.runFileIngestion({
      userId: 1,
      fileId: 1,
      fileName: "prd.txt",
      fileType: "txt",
      taskId: 1
    });

    expect(store.files[0]?.status).toBe("ready");
    expect(store.tasks[0]).toMatchObject({ status: "completed", progress: 100 });
    expect(store.vectorChunks).toHaveLength(1);
    expect(store.vectorChunks[0]).toMatchObject({
      userId: 1,
      fileId: 1,
      fileName: "prd.txt",
      chunkIndex: 0
    });
    expect(store.vectorChunks[0]?.document).toContain("智枢AI是多模态私有化AI智能知识库问答平台");
  });
});
