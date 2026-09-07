import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { mysqlPool } from "../providers/mysql.provider.js";

export type MessageRow = RowDataPacket & {
  id: number;
  conversationId: number;
  userId: number;
  role: "user" | "assistant" | "system";
  content: string;
  inputType: "text" | "audio" | "file" | "image";
  createdAt: Date;
};

export const messageRepository = {
  async create(input: {
    conversationId: number;
    userId: number;
    role: MessageRow["role"];
    content: string;
    inputType?: MessageRow["inputType"];
    modelProvider?: string | null;
    ragUsed?: boolean;
    safetyStatus?: "passed" | "blocked" | "review_required";
    latencyMs?: number | null;
  }) {
    const [result] = await mysqlPool.execute<ResultSetHeader>(
      `INSERT INTO messages
       (conversation_id, user_id, role, content, input_type, model_provider, rag_used, safety_status, latency_ms)
       VALUES
       (:conversationId, :userId, :role, :content, :inputType, :modelProvider, :ragUsed, :safetyStatus, :latencyMs)`,
      {
        ...input,
        inputType: input.inputType ?? "text",
        modelProvider: input.modelProvider ?? null,
        ragUsed: input.ragUsed ?? false,
        safetyStatus: input.safetyStatus ?? "passed",
        latencyMs: input.latencyMs ?? null
      }
    );

    return { id: result.insertId, ...input };
  },

  async findOwnedMessage(input: { userId: number; messageId: number }) {
    const [rows] = await mysqlPool.execute<MessageRow[]>(
      `SELECT id, conversation_id AS conversationId, user_id AS userId, role, content,
              input_type AS inputType, created_at AS createdAt
       FROM messages
       WHERE id = :messageId AND user_id = :userId
       LIMIT 1`,
      input
    );

    return rows[0] ?? null;
  },

  async listRecent(input: { userId: number; conversationId: number; limit: number }) {
    const [rows] = await mysqlPool.execute<MessageRow[]>(
      `SELECT id, conversation_id AS conversationId, user_id AS userId, role, content,
              input_type AS inputType, created_at AS createdAt
       FROM messages
       WHERE user_id = :userId AND conversation_id = :conversationId
       ORDER BY created_at DESC
       LIMIT :limit`,
      input
    );

    return rows.reverse();
  },

  async updateContent(input: { userId: number; messageId: number; content: string; latencyMs?: number | null }) {
    await mysqlPool.execute(
      `UPDATE messages
       SET content = :content, latency_ms = :latencyMs
       WHERE id = :messageId AND user_id = :userId`,
      {
        userId: input.userId,
        messageId: input.messageId,
        content: input.content,
        latencyMs: input.latencyMs ?? null
      }
    );
  },

  async deleteOwnedMessage(input: { userId: number; messageId: number }) {
    await mysqlPool.execute(
      `DELETE FROM messages
       WHERE id = :messageId AND user_id = :userId`,
      input
    );
  }
};
