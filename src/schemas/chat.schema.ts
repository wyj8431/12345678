import { z } from "zod";

export const chatStreamRequestSchema = z.object({
  conversationId: z.number().int().positive().optional(),
  content: z.string().min(1).max(8000),
  inputType: z.enum(["text", "audio", "file", "image"]).default("text"),
  fileIds: z.array(z.number().int().positive()).max(20).optional(),
  temporaryContext: z.string().max(20000).optional()
});

export type ChatStreamRequest = z.infer<typeof chatStreamRequestSchema>;

export type ChatReference = {
  fileId: number;
  fileName: string;
  pageNumber?: number;
  chunkIndex: number;
  score: number;
  quotePreview?: string;
};
