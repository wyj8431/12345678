import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { mysqlPool } from "../providers/mysql.provider.js";

export type ConversationRow = RowDataPacket & {
  id: number;
  userId: number;
  title: string | null;
  summary: string | null;
  status: "active" | "archived" | "deleted";
  createdAt: Date;
  updatedAt: Date;
};

export const conversationRepository = {
  async create(input: { userId: number; title?: string }) {
    const title = input.title ?? "新对话";
    const [result] = await mysqlPool.execute<ResultSetHeader>(
      `INSERT INTO conversations (user_id, title, status)
       VALUES (:userId, :title, 'active')`,
      { userId: input.userId, title }
    );

    return { id: result.insertId, userId: input.userId, title };
  },

  async findOwnedConversation(input: { userId: number; conversationId: number }) {
    const [rows] = await mysqlPool.execute<ConversationRow[]>(
      `SELECT id, user_id AS userId, title, summary, status,
              created_at AS createdAt, updated_at AS updatedAt
       FROM conversations
       WHERE id = :conversationId AND user_id = :userId AND status <> 'deleted'
       LIMIT 1`,
      input
    );

    return rows[0] ?? null;
  },

  async touch(conversationId: number) {
    await mysqlPool.execute(
      `UPDATE conversations SET updated_at = NOW() WHERE id = :conversationId`,
      { conversationId }
    );
  }
};
