import { mysqlPool } from "../providers/mysql.provider.js";
import type { ChatReference } from "../schemas/chat.schema.js";

export const referenceRepository = {
  async createMany(input: { messageId: number; references: ChatReference[] }) {
    if (input.references.length === 0) return;

    await Promise.all(
      input.references.map((reference) =>
        mysqlPool.execute(
          `INSERT INTO message_references
           (message_id, file_id, file_name, page_number, chunk_index, score, quote_preview)
           VALUES
           (:messageId, :fileId, :fileName, :pageNumber, :chunkIndex, :score, :quotePreview)`,
          {
            messageId: input.messageId,
            fileId: reference.fileId,
            fileName: reference.fileName,
            pageNumber: reference.pageNumber ?? null,
            chunkIndex: reference.chunkIndex,
            score: reference.score,
            quotePreview: reference.quotePreview ?? null
          }
        )
      )
    );
  }
};
