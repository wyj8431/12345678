import { describe, expect, it } from "vitest";
import { agentService } from "../src/services/agent.service.js";

describe("agentService", () => {
  it("routes temporary context without retrieval", () => {
    const decision = agentService.decide({
      request: {
        content: "请总结这段内容",
        inputType: "text",
        temporaryContext: "智枢AI是一套知识库问答平台。"
      }
    });

    expect(decision).toMatchObject({
      mode: "temporary_context",
      shouldRetrieve: false,
      reason: "temporary_context_provided"
    });
  });

  it("routes scoped file questions to scoped RAG", () => {
    const decision = agentService.decide({
      request: {
        content: "智枢AI是什么？",
        inputType: "text",
        fileIds: [1, 2]
      }
    });

    expect(decision).toMatchObject({
      mode: "scoped_rag",
      shouldRetrieve: true,
      fileIds: [1, 2]
    });
  });

  it("routes default questions to global RAG", () => {
    const decision = agentService.decide({
      request: {
        content: "智枢AI是什么？",
        inputType: "text"
      }
    });

    expect(decision).toMatchObject({
      mode: "global_rag",
      shouldRetrieve: true
    });
  });
});
