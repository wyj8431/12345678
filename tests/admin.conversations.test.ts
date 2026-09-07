import { beforeEach, describe, expect, it } from "vitest";
import { store } from "../src/mocks/in-memory-store.js";
import { adminService } from "../src/services/admin.service.js";

describe("admin conversation list", () => {
  beforeEach(() => {
    store.messages.length = 0;
  });

  it("builds conversation summaries from mock messages", async () => {
    const earlier = new Date("2026-07-16T00:00:00.000Z").toISOString();
    const later = new Date("2026-07-16T00:01:00.000Z").toISOString();
    store.messages.push(
      {
        id: 1,
        userId: 1,
        conversationId: 100,
        role: "user",
        content: "How does Zhishu AI retrieve references?",
        createdAt: earlier
      },
      {
        id: 2,
        userId: 1,
        conversationId: 100,
        role: "assistant",
        content: "Zhishu AI retrieves vector chunks and returns citations.",
        createdAt: later
      },
      {
        id: 3,
        userId: 1,
        conversationId: 101,
        role: "user",
        content: "Other topic",
        createdAt: earlier
      }
    );

    const result = await adminService.listConversations({
      page: 1,
      pageSize: 20,
      sortOrder: "desc",
      keyword: "citations"
    });

    expect(result.total).toBe(1);
    expect(result.items[0]?.id).toBe(100);
    expect(result.items[0]?.messageCount).toBe(2);
    expect(result.items[0]?.lastMessagePreview).toContain("citations");
    expect(result.items[0]?.updatedAt).toBe(later);
  });
});
