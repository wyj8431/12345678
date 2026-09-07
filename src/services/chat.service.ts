import { env } from "../config/env.js";
import { store } from "../mocks/in-memory-store.js";
import { conversationRepository } from "../repositories/conversation.repository.js";
import { messageRepository } from "../repositories/message.repository.js";
import { referenceRepository } from "../repositories/reference.repository.js";
import type { ChatReference, ChatStreamRequest } from "../schemas/chat.schema.js";
import { AppError } from "../utils/errors.js";
import type { SseWriter } from "../utils/sse.js";
import { agentService, type AgentDecision } from "./agent.service.js";
import { modelService } from "./model.service.js";
import { ragService } from "./rag.service.js";
import { safetyService } from "./safety.service.js";

export const chatService = {
  async streamAnswer(input: {
    userId: number;
    request: ChatStreamRequest;
    sse: SseWriter;
    signal: AbortSignal;
  }) {
    if (env.USE_MOCK_DB) {
      return streamMockAnswer(input);
    }

    return streamMysqlAnswer(input);
  }
};

async function streamMysqlAnswer(input: {
  userId: number;
  request: ChatStreamRequest;
  sse: SseWriter;
  signal: AbortSignal;
}) {
  const startedAt = Date.now();
  input.sse.write({ type: "progress", stage: "safety" });
  await safetyService.assertQuestionAllowed({ userId: input.userId, content: input.request.content });

  const conversationId = await resolveConversationId(input.userId, input.request);

  const userMessage = await messageRepository.create({
    userId: input.userId,
    conversationId,
    role: "user",
    content: input.request.content,
    inputType: input.request.inputType
  });

  const decision = agentService.decide({ request: input.request });
  const assistantMessage = await messageRepository.create({
    userId: input.userId,
    conversationId,
    role: "assistant",
    content: "",
    inputType: "text",
    modelProvider: "mock-model",
    ragUsed: decision.shouldRetrieve
  });

  input.sse.write({ type: "start", conversationId, messageId: assistantMessage.id });
  input.sse.write({ type: "progress", stage: "agent" });
  input.sse.write({ type: "agent_decision", data: decision });

  try {
    const answerContext = await resolveAnswerContext({
      userId: input.userId,
      request: input.request,
      conversationId,
      messageId: userMessage.id,
      decision,
      sse: input.sse
    });

    if (answerContext.references.length > 0) {
      input.sse.write({ type: "references", data: answerContext.references });
    }

    input.sse.write({ type: "progress", stage: "generation" });

    let fullAnswer = "";
    const modelStream = modelService.streamAnswer({
      userId: input.userId,
      conversationId,
      query: input.request.content,
      context: answerContext.context,
      useFallback: answerContext.context.trim().length === 0,
      contextSource: answerContext.contextSource,
      signal: input.signal
    });

    for await (const delta of modelStream) {
      if (input.signal.aborted) {
        await messageRepository.deleteOwnedMessage({ userId: input.userId, messageId: assistantMessage.id });
        return;
      }
      fullAnswer += delta;
      input.sse.write({ type: "content", delta });
    }

    if (input.signal.aborted) {
      await messageRepository.deleteOwnedMessage({ userId: input.userId, messageId: assistantMessage.id });
      return;
    }

    const latencyMs = Date.now() - startedAt;
    await messageRepository.updateContent({
      userId: input.userId,
      messageId: assistantMessage.id,
      content: fullAnswer,
      latencyMs
    });
    await referenceRepository.createMany({ messageId: assistantMessage.id, references: answerContext.references });
    await conversationRepository.touch(conversationId);

    input.sse.write({
      type: "done",
      usage: {
        latencyMs,
        provider: answerContext.provider
      }
    });
  } catch (error) {
    await messageRepository.deleteOwnedMessage({ userId: input.userId, messageId: assistantMessage.id });
    throw error;
  }
}

async function streamMockAnswer(input: {
  userId: number;
  request: ChatStreamRequest;
  sse: SseWriter;
  signal: AbortSignal;
}) {
  const startedAt = Date.now();
  const conversationId = input.request.conversationId ?? 1;

  input.sse.write({ type: "progress", stage: "safety" });
  await safetyService.assertQuestionAllowed({ userId: input.userId, content: input.request.content });

  const userMessage = {
    id: store.nextMessageId++,
    userId: input.userId,
    conversationId,
    role: "user" as const,
    content: input.request.content,
    createdAt: new Date().toISOString()
  };
  store.messages.push(userMessage);

  const assistantMessageId = store.nextMessageId++;
  input.sse.write({ type: "start", conversationId, messageId: assistantMessageId });
  input.sse.write({ type: "progress", stage: "agent" });
  const decision = agentService.decide({ request: input.request });
  input.sse.write({ type: "agent_decision", data: decision });

  const answerContext = await resolveAnswerContext({
    userId: input.userId,
    request: input.request,
    conversationId,
    messageId: userMessage.id,
    decision,
    sse: input.sse
  });

  if (answerContext.references.length > 0) {
    input.sse.write({ type: "references", data: answerContext.references });
  }

  input.sse.write({ type: "progress", stage: "generation" });

  let fullAnswer = "";
  const modelStream = modelService.streamAnswer({
    userId: input.userId,
    conversationId,
    query: input.request.content,
    context: answerContext.context,
    useFallback: answerContext.context.trim().length === 0,
    contextSource: answerContext.contextSource,
    signal: input.signal
  });

  for await (const delta of modelStream) {
    if (input.signal.aborted) return;
    fullAnswer += delta;
    input.sse.write({ type: "content", delta });
  }

  store.messages.push({
    id: assistantMessageId,
    userId: input.userId,
    conversationId,
    role: "assistant",
    content: fullAnswer,
    createdAt: new Date().toISOString()
  });

  input.sse.write({
    type: "done",
    usage: {
      latencyMs: Date.now() - startedAt,
      provider: answerContext.provider
    }
  });
}

async function resolveAnswerContext(input: {
  userId: number;
  request: ChatStreamRequest;
  conversationId: number;
  messageId: number;
  decision: AgentDecision;
  sse: SseWriter;
}): Promise<{
  context: string;
  references: ChatReference[];
  provider: string;
  contextSource: "knowledge_base" | "temporary_context";
}> {
  if (!input.decision.shouldRetrieve) {
    return {
      context: input.decision.temporaryContext ?? "",
      references: [],
      provider: "mock-temporary-context",
      contextSource: "temporary_context"
    };
  }

  input.sse.write({ type: "progress", stage: "retrieval" });
  const ragResult = await ragService.search({
    userId: input.userId,
    query: input.request.content,
    fileIds: input.decision.fileIds,
    conversationId: input.conversationId,
    messageId: input.messageId
  });

  return {
    context: ragResult.context,
    references: ragResult.references,
    provider: ragResult.references.length > 0 ? "mock-rag" : "mock-fallback",
    contextSource: "knowledge_base"
  };
}

async function resolveConversationId(userId: number, request: ChatStreamRequest) {
  if (request.conversationId) {
    const conversation = await conversationRepository.findOwnedConversation({
      userId,
      conversationId: request.conversationId
    });
    if (!conversation) {
      throw new AppError("CHAT_001", "Conversation not found", 404);
    }

    return conversation.id;
  }

  const conversation = await conversationRepository.create({
    userId,
    title: createConversationTitle(request.content)
  });
  return conversation.id;
}

function createConversationTitle(content: string) {
  const title = content.trim().replace(/\s+/g, " ").slice(0, 30);
  return title.length > 0 ? title : "新对话";
}
