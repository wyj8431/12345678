import type { ResultSetHeader } from "mysql2/promise";
import { mysqlPool } from "../providers/mysql.provider.js";
import type { FeedbackCreateRequest } from "../schemas/feedback.schema.js";

export const feedbackRepository = {
  async create(input: FeedbackCreateRequest & { userId: number }) {
    const [result] = await mysqlPool.execute<ResultSetHeader>(
      `INSERT INTO feedback (message_id, user_id, rating, reason, comment)
       VALUES (:messageId, :userId, :rating, :reason, :comment)`,
      {
        messageId: input.messageId,
        userId: input.userId,
        rating: input.rating,
        reason: input.reason ?? null,
        comment: input.comment ?? null
      }
    );

    return { id: result.insertId, ...input };
  }
};
