import { z } from "zod";

export const feedbackCreateSchema = z.object({
  messageId: z.number().int().positive(),
  rating: z.enum(["up", "down"]),
  reason: z
    .enum(["answer_irrelevant", "wrong_citation", "incomplete", "hallucination", "other"])
    .optional(),
  comment: z.string().max(512).optional()
});

export type FeedbackCreateRequest = z.infer<typeof feedbackCreateSchema>;
