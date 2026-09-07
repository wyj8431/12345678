import { env } from "../config/env.js";
import { store, type IngestTask, type KnowledgeFile } from "../mocks/in-memory-store.js";
import { embeddingProvider } from "../providers/embedding.provider.js";
import { vectorSearchProvider, type VectorChunkUpsertInput } from "../providers/vector-search.provider.js";
import { fileRepository } from "../repositories/file.repository.js";
import { ingestTaskRepository, type IngestTaskRow } from "../repositories/ingest-task.repository.js";

type IngestStatus = IngestTask["status"] | IngestTaskRow["status"];

export const ingestionService = {
  scheduleFileIngestion(input: {
    userId: number;
    fileId: number;
    fileName: string;
    fileType: KnowledgeFile["fileType"];
    taskId: number;
  }) {
    setTimeout(() => {
      void this.runFileIngestion(input).catch(() => undefined);
    }, 10);
  },

  async runFileIngestion(input: {
    userId: number;
    fileId: number;
    fileName: string;
    fileType: KnowledgeFile["fileType"];
    taskId: number;
  }) {
    try {
      await updateTask(input.userId, input.taskId, "parsing", 15);
      const rawText = parseMockFile(input.fileName, input.fileType);

      await updateTask(input.userId, input.taskId, "cleaning", 35);
      const cleanText = cleanParsedText(rawText);

      await updateTask(input.userId, input.taskId, "chunking", 55);
      const chunks = chunkText(cleanText).map((document, index) => ({
        id: `file:${input.userId}:${input.fileId}:${index}`,
        userId: input.userId,
        fileId: input.fileId,
        fileName: input.fileName,
        document,
        pageNumber: 1,
        chunkIndex: index
      }));

      await updateTask(input.userId, input.taskId, "embedding", 75);
      const vectorChunks: VectorChunkUpsertInput[] = [];
      for (const chunk of chunks) {
        vectorChunks.push({
          ...chunk,
          embedding: await embeddingProvider.embedQuery(chunk.document)
        });
      }

      await updateTask(input.userId, input.taskId, "upserting", 90);
      await vectorSearchProvider.upsertChunks(vectorChunks);

      await markFileReady(input.userId, input.fileId, vectorChunks.length);
      await updateTask(input.userId, input.taskId, "completed", 100);
    } catch (error) {
      await updateTask(input.userId, input.taskId, "failed", 100, {
        errorCode: "INGEST_FAILED",
        errorMessage: error instanceof Error ? error.message : "Ingestion failed"
      });
    }
  }
};

async function updateTask(
  userId: number,
  taskId: number,
  status: IngestStatus,
  progress: number,
  error?: { errorCode: string; errorMessage: string }
) {
  if (env.USE_MOCK_DB) {
    const task = store.tasks.find((item) => item.userId === userId && item.id === taskId);
    if (!task) return;

    task.status = status as IngestTask["status"];
    task.progress = progress;
    task.errorCode = error?.errorCode;
    task.errorMessage = error?.errorMessage;
    return;
  }

  await ingestTaskRepository.updateStatus({
    userId,
    taskId,
    status: status as IngestTaskRow["status"],
    progress,
    errorCode: error?.errorCode,
    errorMessage: error?.errorMessage
  });
}

async function markFileReady(userId: number, fileId: number, chunkCount: number) {
  if (env.USE_MOCK_DB) {
    const file = store.files.find((item) => item.userId === userId && item.id === fileId);
    if (file) file.status = "ready";
    return;
  }

  await fileRepository.markReady({ userId, fileId, chunkCount });
}

function parseMockFile(fileName: string, fileType: KnowledgeFile["fileType"]) {
  if (fileType === "image") {
    return `${fileName} OCR result: 智枢AI支持图片OCR入库，并把识别文本切片后写入向量库。`;
  }
  if (fileType === "audio") {
    return `${fileName} ASR result: 智枢AI支持语音转文字入库，并保留引用来源。`;
  }

  return `${fileName}: 智枢AI是多模态私有化AI智能知识库问答平台，核心包含RAG、Agent、文件入库、SSE流式返回和大模型兜底。`;
}

function cleanParsedText(text: string) {
  return text.replace(/\s+/g, " ").trim();
}

function chunkText(text: string) {
  const maxLength = 180;
  const chunks: string[] = [];
  for (let start = 0; start < text.length; start += maxLength) {
    chunks.push(text.slice(start, start + maxLength));
  }
  return chunks.length > 0 ? chunks : [text];
}
