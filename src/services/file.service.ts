import { nanoid } from "nanoid";
import { env } from "../config/env.js";
import { store, type IngestTask, type KnowledgeFile } from "../mocks/in-memory-store.js";
import { vectorSearchProvider } from "../providers/vector-search.provider.js";
import { fileRepository } from "../repositories/file.repository.js";
import { ingestTaskRepository } from "../repositories/ingest-task.repository.js";
import type { FileCompleteRequest, FileInitRequest } from "../schemas/file.schema.js";
import { AppError } from "../utils/errors.js";
import { ingestionService } from "./ingestion.service.js";

export const fileService = {
  async initUpload(userId: number, input: FileInitRequest) {
    assertAllowedFile(input.fileSize);

    if (env.USE_MOCK_DB) {
      store.auditLogs.push({
        id: store.nextAuditLogId++,
        userId,
        action: "file_upload_init",
        targetType: "upload",
        riskLevel: "low",
        status: "success",
        createdAt: new Date().toISOString()
      });
    }

    return {
      uploadId: nanoid(24),
      chunkSize: 2 * 1024 * 1024
    };
  },

  async completeUpload(userId: number, input: FileCompleteRequest) {
    assertAllowedFile(input.fileSize);

    if (!env.USE_MOCK_DB) {
      const storagePath = `mock://uploads/${userId}/${input.uploadId}/${input.fileName}`;
      const file = await fileRepository.create({
        userId,
        fileName: input.fileName,
        fileSize: input.fileSize,
        fileType: input.fileType,
        storagePath,
        checksum: input.checksum,
        ingestMode: input.ingestMode
      });
      const task = await ingestTaskRepository.create({
        userId,
        fileId: file.id,
        taskType: toTaskType(input.fileType)
      });

      ingestionService.scheduleFileIngestion({
        userId,
        fileId: file.id,
        fileName: input.fileName,
        fileType: input.fileType,
        taskId: task.id,
      });

      return { fileId: file.id, taskId: task.id, status: "processing" };
    }

    const file: KnowledgeFile = {
      id: store.nextFileId++,
      userId,
      fileName: input.fileName,
      fileSize: input.fileSize,
      fileType: input.fileType,
      checksum: input.checksum,
      ingestMode: input.ingestMode,
      status: "processing",
      createdAt: new Date().toISOString()
    };
    store.files.push(file);

    const task: IngestTask = {
      id: store.nextTaskId++,
      userId,
      fileId: file.id,
      taskType: toTaskType(input.fileType),
      status: "pending",
      progress: 0,
      createdAt: new Date().toISOString()
    };
    store.tasks.push(task);

    ingestionService.scheduleFileIngestion({
      userId,
      fileId: file.id,
      fileName: input.fileName,
      fileType: input.fileType,
      taskId: task.id
    });

    return { fileId: file.id, taskId: task.id, status: "processing" };
  },

  async listFiles(userId: number) {
    if (!env.USE_MOCK_DB) {
      return fileRepository.listByUser(userId);
    }

    return store.files.filter((file) => file.userId === userId && file.status !== "deleted");
  },

  async deleteFile(userId: number, fileId: number) {
    if (!env.USE_MOCK_DB) {
      const file = await fileRepository.findOwnedFile({ userId, fileId });
      if (!file) {
        throw new AppError("FILE_001", "File not found", 404);
      }

      await vectorSearchProvider.deleteByFile({ userId, fileId });
      await fileRepository.markDeleted({ userId, fileId });
      return { deleted: true };
    }

    const file = store.files.find((item) => item.userId === userId && item.id === fileId);
    if (!file || file.status === "deleted") {
      throw new AppError("FILE_001", "File not found", 404);
    }

    await vectorSearchProvider.deleteByFile({ userId, fileId });
    file.status = "deleted";
    store.auditLogs.push({
      id: store.nextAuditLogId++,
      userId,
      action: "file_delete",
      targetType: "file",
      targetId: fileId,
      riskLevel: "low",
      status: "success",
      createdAt: new Date().toISOString()
    });

    return { deleted: true };
  },

  async getTask(userId: number, taskId: number) {
    if (!env.USE_MOCK_DB) {
      const task = await ingestTaskRepository.findOwnedTask({ userId, taskId });
      if (!task) {
        throw new AppError("INGEST_001", "Ingest task not found", 404);
      }

      return task;
    }

    const task = store.tasks.find((item) => item.userId === userId && item.id === taskId);
    if (!task) {
      throw new AppError("INGEST_001", "Ingest task not found", 404);
    }

    return task;
  }
};

function assertAllowedFile(fileSize: number) {
  const maxSize = 50 * 1024 * 1024;
  if (fileSize > maxSize) {
    throw new AppError("FILE_003", "File is too large", 400);
  }
}

function toTaskType(fileType: FileCompleteRequest["fileType"]) {
  if (fileType === "image") return "image";
  if (fileType === "audio") return "audio";
  return "file";
}
