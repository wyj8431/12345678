import { env } from "../config/env.js";
import { store } from "../mocks/in-memory-store.js";
import { feedbackRepository } from "../repositories/feedback.repository.js";
import { messageRepository } from "../repositories/message.repository.js";
import type { FeedbackCreateRequest } from "../schemas/feedback.schema.js";
import { AppError } from "../utils/errors.js";

export const feedbackService = {
  async create(userId: number, input: FeedbackCreateRequest) {
    if (!env.USE_MOCK_DB) {
      const message = await messageRepository.findOwnedMessage({
        userId,
        messageId: input.messageId
      });

      if (!message) {
        throw new AppError("MESSAGE_001", "Message not found", 404);
      }

      if (message.role !== "assistant") {
        throw new AppError("FEEDBACK_001", "Only assistant messages can receive feedback", 400);
      }

      return feedbackRepository.create({ userId, ...input });
    }

    const message = store.messages.find((item) => item.id === input.messageId && item.userId === userId);
    if (!message) {
      throw new AppError("MESSAGE_001", "Message not found", 404);
    }

    if (message.role !== "assistant") {
      throw new AppError("FEEDBACK_001", "Only assistant messages can receive feedback", 400);
    }

    const feedback = {
      id: store.nextFeedbackId++,
      userId,
      messageId: input.messageId,
      rating: input.rating,
      reason: input.reason,
      comment: input.comment,
      createdAt: new Date().toISOString()
    };

    store.feedback.push(feedback);
    return feedback;
  }
};
