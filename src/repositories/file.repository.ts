import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { mysqlPool } from "../providers/mysql.provider.js";

export type FileRow = RowDataPacket & {
  id: number;
  userId: number;
  fileName: string;
  fileType: "pdf" | "word" | "excel" | "txt" | "image" | "audio";
  fileSize: number;
  storagePath: string;
  ingestMode: "temporary" | "permanent";
  status: "uploaded" | "processing" | "ready" | "failed" | "deleted";
  checksum: string;
  chunkCount: number;
  createdAt: Date;
};

export const fileRepository = {
  async create(input: {
    userId: number;
    fileName: string;
    fileType: FileRow["fileType"];
    fileSize: number;
    storagePath: string;
    checksum: string;
    ingestMode: "temporary" | "permanent";
  }) {
    const [result] = await mysqlPool.execute<ResultSetHeader>(
      `INSERT INTO knowledge_files
       (user_id, file_name, file_type, file_size, storage_path, checksum, ingest_mode, status)
       VALUES (:userId, :fileName, :fileType, :fileSize, :storagePath, :checksum, :ingestMode, 'processing')`,
      input
    );

    return { id: result.insertId, ...input };
  },

  async listByUser(userId: number) {
    const [rows] = await mysqlPool.execute<FileRow[]>(
      `SELECT id, user_id AS userId, file_name AS fileName, file_type AS fileType,
              file_size AS fileSize, storage_path AS storagePath, ingest_mode AS ingestMode,
              status, checksum, chunk_count AS chunkCount, created_at AS createdAt
       FROM knowledge_files
       WHERE user_id = :userId AND status <> 'deleted'
       ORDER BY created_at DESC`,
      { userId }
    );

    return rows;
  },

  async findOwnedFile(input: { userId: number; fileId: number }) {
    const [rows] = await mysqlPool.execute<FileRow[]>(
      `SELECT id, user_id AS userId, file_name AS fileName, file_type AS fileType,
              file_size AS fileSize, storage_path AS storagePath, ingest_mode AS ingestMode,
              status, checksum, chunk_count AS chunkCount, created_at AS createdAt
       FROM knowledge_files
       WHERE id = :fileId AND user_id = :userId AND status <> 'deleted'
       LIMIT 1`,
      input
    );

    return rows[0] ?? null;
  },

  async markReady(input: { userId: number; fileId: number; chunkCount: number }) {
    await mysqlPool.execute(
      `UPDATE knowledge_files
       SET status = 'ready', chunk_count = :chunkCount
       WHERE id = :fileId AND user_id = :userId`,
      input
    );
  },

  async markDeleted(input: { userId: number; fileId: number }) {
    await mysqlPool.execute(
      `UPDATE knowledge_files
       SET status = 'deleted', deleted_at = NOW()
       WHERE id = :fileId AND user_id = :userId`,
      input
    );
  }
};
