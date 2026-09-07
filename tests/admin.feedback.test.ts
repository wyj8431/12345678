import { beforeEach, describe, expect, it } from "vitest";
import { store } from "../src/mocks/in-memory-store.js";
import { adminService } from "../src/services/admin.service.js";

describe("admin feedback list", () => {
  beforeEach(() => {
    store.messages.length = 0;
    store.feedback.length = 0;
  });

  it("lists feedback details with message previews", async () => {
    const now = new Date().toISOString();
    store.messages.push({
      id: 10,
      userId: 1,
      conversationId: 5,
      role: "assistant",
      content: "The answer used the wrong source citation.",
      createdAt: now
    });
    store.feedback.push(
      {
        id: 1,
        userId: 1,
        messageId: 10,
        rating: "down",
        reason: "wrong_citation",
        comment: "Please check source A",
        createdAt: now
      },
      {
        id: 2,
        userId: 1,
        messageId: 10,
        rating: "up",
        createdAt: now
      }
    );

    const result = await adminService.listFeedback({
      page: 1,
      pageSize: 20,
      sortOrder: "desc",
      rating: "down",
      reason: "wrong_citation",
      keyword: "source"
    });

    expect(result.total).toBe(1);
    expect(result.items[0]?.messageId).toBe(10);
    expect(result.items[0]?.conversationId).toBe(5);
    expect(result.items[0]?.messagePreview).toContain("wrong source");
  });
});
