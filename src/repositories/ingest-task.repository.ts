import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { mysqlPool } from "../providers/mysql.provider.js";

export type IngestTaskRow = RowDataPacket & {
  id: number;
  fileId: number;
  userId: number;
  taskType: "file" | "image" | "audio" | "delete_chroma_vectors";
  status:
    | "pending"
    | "parsing"
    | "cleaning"
    | "chunking"
    | "embedding"
    | "upserting"
    | "processing"
    | "completed"
    | "failed";
  progress: number;
  errorCode: string | null;
  errorMessage: string | null;
  createdAt: Date;
  finishedAt: Date | null;
};

export const ingestTaskRepository = {
  async create(input: {
    userId: number;
    fileId: number;
    taskType: IngestTaskRow["taskType"];
  }) {
    const [result] = await mysqlPool.execute<ResultSetHeader>(
      `INSERT INTO ingest_tasks (user_id, file_id, task_type, status, progress)
       VALUES (:userId, :fileId, :taskType, 'pending', 0)`,
      input
    );

    return { id: result.insertId, ...input };
  },

  async updateStatus(input: {
    userId: number;
    taskId: number;
    status: IngestTaskRow["status"];
    progress: number;
    errorCode?: string;
    errorMessage?: string;
  }) {
    await mysqlPool.execute(
      `UPDATE ingest_tasks
       SET status = :status,
           progress = :progress,
           error_code = :errorCode,
           error_message = :errorMessage,
           finished_at = IF(:status IN ('completed', 'failed'), NOW(), finished_at)
       WHERE id = :taskId AND user_id = :userId`,
      {
        ...input,
        errorCode: input.errorCode ?? null,
        errorMessage: input.errorMessage ?? null
      }
    );
  },

  async findOwnedTask(input: { userId: number; taskId: number }) {
    const [rows] = await mysqlPool.execute<IngestTaskRow[]>(
      `SELECT id, file_id AS fileId, user_id AS userId, task_type AS taskType,
              status, progress, error_code AS errorCode, error_message AS errorMessage,
              created_at AS createdAt, finished_at AS finishedAt
       FROM ingest_tasks
       WHERE id = :taskId AND user_id = :userId
       LIMIT 1`,
      input
    );

    return rows[0] ?? null;
  }
};
