import { beforeEach, describe, expect, it } from "vitest";
import { store } from "../src/mocks/in-memory-store.js";
import { adminService } from "../src/services/admin.service.js";

describe("admin message list", () => {
  beforeEach(() => {
    store.messages.length = 0;
  });

  it("lists messages by conversation and role with previews", async () => {
    const now = new Date().toISOString();
    store.messages.push(
      {
        id: 1,
        userId: 1,
        conversationId: 100,
        role: "user",
        content: "How does Zhishu AI upload files?",
        createdAt: now
      },
      {
        id: 2,
        userId: 1,
        conversationId: 100,
        role: "assistant",
        content: "Zhishu AI creates an ingest task, parses files, chunks text, embeds chunks, and upserts vectors.",
        createdAt: now
      },
      {
        id: 3,
        userId: 1,
        conversationId: 101,
        role: "assistant",
        content: "Another conversation",
        createdAt: now
      }
    );

    const result = await adminService.listMessages({
      page: 1,
      pageSize: 20,
      sortOrder: "desc",
      conversationId: 100,
      role: "assistant",
      keyword: "vectors"
    });

    expect(result.total).toBe(1);
    expect(result.items[0]?.id).toBe(2);
    expect(result.items[0]?.contentPreview).toContain("upserts vectors");
  });
});
