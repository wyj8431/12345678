import type { ChatStreamRequest } from "../schemas/chat.schema.js";

export type AgentDecision = {
  mode: "temporary_context" | "scoped_rag" | "global_rag";
  shouldRetrieve: boolean;
  fileIds?: number[];
  temporaryContext?: string;
  reason: string;
};

export const agentService = {
  decide(input: { request: ChatStreamRequest }): AgentDecision {
    const temporaryContext = input.request.temporaryContext?.trim();
    if (temporaryContext) {
      return {
        mode: "temporary_context",
        shouldRetrieve: false,
        temporaryContext,
        reason: "temporary_context_provided"
      };
    }

    if (input.request.fileIds?.length) {
      return {
        mode: "scoped_rag",
        shouldRetrieve: true,
        fileIds: input.request.fileIds,
        reason: "file_scope_provided"
      };
    }

    return {
      mode: "global_rag",
      shouldRetrieve: true,
      reason: "default_knowledge_base_search"
    };
  }
};
