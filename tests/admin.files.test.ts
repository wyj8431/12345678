import { beforeEach, describe, expect, it } from "vitest";
import { store } from "../src/mocks/in-memory-store.js";
import { adminService } from "../src/services/admin.service.js";

describe("admin file list", () => {
  beforeEach(() => {
    store.files.length = 0;
    store.tasks.length = 0;
    store.vectorChunks.length = 0;
  });

  it("lists files with filters, keyword search, and chunk counts", async () => {
    const earlier = new Date("2026-07-16T00:00:00.000Z").toISOString();
    const later = new Date("2026-07-16T00:01:00.000Z").toISOString();

    store.files.push(
      {
        id: 1,
        userId: 1,
        fileName: "zhishu-prd.txt",
        fileSize: 1024,
        fileType: "txt",
        checksum: "checksum-prd",
        ingestMode: "permanent",
        status: "ready",
        createdAt: earlier
      },
      {
        id: 2,
        userId: 2,
        fileName: "other-audio.mp3",
        fileSize: 2048,
        fileType: "audio",
        checksum: "checksum-audio",
        ingestMode: "temporary",
        status: "processing",
        createdAt: later
      }
    );

    store.vectorChunks.push(
      {
        id: "chunk-1",
        userId: 1,
        fileId: 1,
        fileName: "zhishu-prd.txt",
        document: "智枢AI PRD",
        embedding: [0.1, 0.2],
        chunkIndex: 0,
        createdAt: earlier
      },
      {
        id: "chunk-2",
        userId: 1,
        fileId: 1,
        fileName: "zhishu-prd.txt",
        document: "RAG knowledge chunk",
        embedding: [0.2, 0.3],
        chunkIndex: 1,
        createdAt: earlier
      }
    );

    const result = await adminService.listFiles({
      page: 1,
      pageSize: 20,
      sortOrder: "desc",
      keyword: "prd",
      userId: 1,
      fileType: "txt",
      status: "ready",
      ingestMode: "permanent"
    });

    expect(result.total).toBe(1);
    expect(result.items[0]).toMatchObject({
      id: 1,
      userId: 1,
      fileName: "zhishu-prd.txt",
      fileType: "txt",
      status: "ready",
      chunkCount: 2
    });
  });

  it("returns file detail with related ingest tasks", async () => {
    const earlier = new Date("2026-07-16T00:00:00.000Z").toISOString();
    const later = new Date("2026-07-16T00:01:00.000Z").toISOString();

    store.files.push({
      id: 1,
      userId: 1,
      fileName: "zhishu-prd.txt",
      fileSize: 1024,
      fileType: "txt",
      checksum: "checksum-prd",
      ingestMode: "permanent",
      status: "ready",
      createdAt: earlier
    });

    store.tasks.push(
      {
        id: 1,
        userId: 1,
        fileId: 1,
        taskType: "file",
        status: "completed",
        progress: 100,
        createdAt: earlier
      },
      {
        id: 2,
        userId: 1,
        fileId: 1,
        taskType: "file",
        status: "failed",
        progress: 40,
        errorCode: "PARSE_FAILED",
        errorMessage: "parse failed",
        createdAt: later
      }
    );

    store.vectorChunks.push({
      id: "chunk-1",
      userId: 1,
      fileId: 1,
      fileName: "zhishu-prd.txt",
      document: "RAG knowledge chunk",
      embedding: [0.2, 0.3],
      chunkIndex: 0,
      createdAt: earlier
    });

    const result = await adminService.getFileDetail(1);

    expect(result.file).toMatchObject({
      id: 1,
      fileName: "zhishu-prd.txt",
      chunkCount: 1
    });
    expect(result.ingestTasks).toHaveLength(2);
    expect(result.ingestTasks[0]).toMatchObject({
      id: 2,
      status: "failed",
      errorCode: "PARSE_FAILED"
    });
  });

  it("throws a not found error when file detail does not exist", async () => {
    await expect(adminService.getFileDetail(404)).rejects.toMatchObject({
      code: "FILE_001",
      status: 404
    });
  });
});
