import { beforeEach, describe, expect, it } from "vitest";
import { store } from "../src/mocks/in-memory-store.js";
import { adminService } from "../src/services/admin.service.js";

describe("adminService", () => {
  beforeEach(() => {
    store.files.length = 0;
    store.vectorChunks.length = 0;
    store.messages.length = 0;
    store.modelCallLogs.length = 0;
    store.ragQueryLogs.length = 0;
    store.tasks.length = 0;
    store.feedback.length = 0;
    store.auditLogs.length = 0;
    store.mockUsers.splice(0, store.mockUsers.length, {
      id: 2,
      username: "mock-user-2",
      role: "user",
      status: "active",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z"
    });
    store.nextAuditLogId = 1;
  });

  it("returns dashboard metrics from mock store", async () => {
    store.messages.push({
      id: 1,
      userId: 1,
      conversationId: 1,
      role: "user",
      content: "hello",
      createdAt: new Date().toISOString()
    });
    store.ragQueryLogs.push({
      id: 1,
      userId: 1,
      query: "智枢",
      hitCount: 1,
      maxScore: 0.91,
      usedFallback: false,
      latencyMs: 5,
      createdAt: new Date().toISOString()
    });

    const metrics = await adminService.getDashboardMetrics();

    expect(metrics.chatCount).toBe(1);
    expect(metrics.ragHitRate).toBe(1);
  });

  it("returns dashboard trends with daily operational metrics", async () => {
    const now = new Date().toISOString();
    const today = now.slice(0, 10);
    store.messages.push({
      id: 1,
      userId: 1,
      conversationId: 1,
      role: "user",
      content: "trend question",
      createdAt: now
    });
    store.modelCallLogs.push(
      {
        id: 1,
        userId: 1,
        conversationId: 1,
        provider: "mock-model",
        purpose: "chat",
        status: "success",
        latencyMs: 20,
        createdAt: now
      },
      {
        id: 2,
        userId: 1,
        conversationId: 1,
        provider: "mock-model",
        purpose: "chat",
        status: "success",
        latencyMs: 40,
        createdAt: now
      }
    );
    store.ragQueryLogs.push(
      {
        id: 1,
        userId: 1,
        query: "trend hit",
        hitCount: 1,
        usedFallback: false,
        latencyMs: 8,
        createdAt: now
      },
      {
        id: 2,
        userId: 1,
        query: "trend fallback",
        hitCount: 0,
        usedFallback: true,
        latencyMs: 10,
        createdAt: now
      }
    );
    store.auditLogs.push({
      id: 1,
      userId: 1,
      action: "chat_safety_check",
      riskLevel: "high",
      status: "blocked",
      createdAt: now
    });
    store.feedback.push({
      id: 1,
      userId: 1,
      messageId: 1,
      rating: "down",
      createdAt: now
    });

    const result = await adminService.getDashboardTrends({ days: 7 });
    const todayPoint = result.points.find((point) => point.date === today);

    expect(result.days).toBe(7);
    expect(result.points).toHaveLength(7);
    expect(todayPoint).toMatchObject({
      chatCount: 1,
      modelCallCount: 2,
      avgModelLatencyMs: 30,
      ragQueryCount: 2,
      fallbackCount: 1,
      fallbackRate: 0.5,
      safetyBlockCount: 1,
      feedbackCount: 1
    });
  });

  it("returns dashboard breakdown distributions from recent mock data", async () => {
    const now = new Date().toISOString();
    const oldDate = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();

    store.files.push(
      {
        id: 1,
        userId: 1,
        fileName: "ready.txt",
        fileSize: 100,
        fileType: "txt",
        checksum: "ready-checksum",
        ingestMode: "permanent",
        status: "ready",
        createdAt: now
      },
      {
        id: 2,
        userId: 1,
        fileName: "old-failed.txt",
        fileSize: 100,
        fileType: "txt",
        checksum: "old-checksum",
        ingestMode: "permanent",
        status: "failed",
        createdAt: oldDate
      }
    );
    store.tasks.push({
      id: 1,
      userId: 1,
      fileId: 1,
      taskType: "file",
      status: "completed",
      progress: 100,
      createdAt: now
    });
    store.modelCallLogs.push({
      id: 1,
      userId: 1,
      conversationId: 1,
      provider: "mock-model",
      purpose: "chat",
      status: "success",
      latencyMs: 20,
      createdAt: now
    });
    store.ragQueryLogs.push(
      {
        id: 1,
        userId: 1,
        query: "recent fallback",
        hitCount: 0,
        usedFallback: true,
        latencyMs: 10,
        createdAt: now
      },
      {
        id: 2,
        userId: 1,
        query: "recent hit",
        hitCount: 1,
        usedFallback: false,
        latencyMs: 8,
        createdAt: now
      }
    );
    store.feedback.push(
      {
        id: 1,
        userId: 1,
        messageId: 1,
        rating: "up",
        createdAt: now
      },
      {
        id: 2,
        userId: 1,
        messageId: 2,
        rating: "down",
        reason: "wrong_citation",
        createdAt: now
      }
    );
    store.auditLogs.push({
      id: 1,
      userId: 1,
      action: "chat_safety_check",
      riskLevel: "high",
      status: "blocked",
      createdAt: now
    });

    const result = await adminService.getDashboardBreakdowns({ days: 7 });

    expect(result).toMatchObject({
      days: 7,
      filesByStatus: { ready: 1 },
      ingestTasksByStatus: { completed: 1 },
      modelCallsByStatus: { success: 1 },
      modelCallsByPurpose: { chat: 1 },
      ragFallback: { fallback: 1, nonFallback: 1 },
      feedbackByRating: { up: 1, down: 1 },
      feedbackDownReasons: { wrong_citation: 1 },
      auditByRiskLevel: { high: 1 },
      auditByStatus: { blocked: 1 }
    });
    expect(result.filesByStatus.failed).toBeUndefined();
  });

  it("returns security overview for audit dashboard widgets", async () => {
    const now = new Date().toISOString();
    const oldDate = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();

    store.auditLogs.push(
      {
        id: 1,
        userId: 1,
        action: "auth_login",
        riskLevel: "medium",
        status: "failed",
        errorCode: "AUTH_INVALID_CREDENTIALS",
        createdAt: now
      },
      {
        id: 2,
        userId: 1,
        action: "rbac_permission_denied",
        riskLevel: "high",
        status: "blocked",
        errorCode: "RBAC_403",
        createdAt: now
      },
      {
        id: 3,
        userId: 2,
        action: "chat_safety_check",
        riskLevel: "high",
        status: "blocked",
        errorCode: "SAFETY_BLOCKED",
        createdAt: now
      },
      {
        id: 4,
        userId: 1,
        action: "auth_login",
        riskLevel: "low",
        status: "success",
        createdAt: oldDate
      }
    );

    const result = await adminService.getSecurityOverview({ days: 7 });

    expect(result).toMatchObject({
      days: 7,
      totalAuditCount: 3,
      successCount: 0,
      failedCount: 1,
      blockedCount: 2,
      highRiskCount: 2,
      authFailureCount: 1,
      permissionDeniedCount: 1,
      safetyBlockCount: 2,
      uniqueUserCount: 2,
      auditByRiskLevel: { medium: 1, high: 2 },
      auditByStatus: { failed: 1, blocked: 2 }
    });
    expect(result.topActions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ action: "auth_login", count: 1, failedCount: 1 }),
        expect.objectContaining({ action: "rbac_permission_denied", count: 1, blockedCount: 1 })
      ])
    );
    expect(result.recentHighRiskLogs).toHaveLength(2);
    expect(result.recentHighRiskLogs[0]).not.toHaveProperty("password");
    expect(result.recentHighRiskLogs[0]).not.toHaveProperty("token");
  });

  it("paginates and filters ingest tasks for admin tables", async () => {
    const now = new Date().toISOString();
    store.tasks.push(
      {
        id: 1,
        userId: 1,
        fileId: 10,
        taskType: "file",
        status: "completed",
        progress: 100,
        createdAt: now
      },
      {
        id: 2,
        userId: 1,
        fileId: 11,
        taskType: "file",
        status: "failed",
        progress: 50,
        errorCode: "PARSE_FAILED",
        createdAt: now
      },
      {
        id: 3,
        userId: 2,
        fileId: 12,
        taskType: "image",
        status: "completed",
        progress: 100,
        createdAt: now
      }
    );

    const result = await adminService.listIngestTasks({
      page: 1,
      pageSize: 1,
      sortOrder: "desc",
      status: "completed",
      userId: 1
    });

    expect(result.total).toBe(1);
    expect(result.totalPages).toBe(1);
    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.fileId).toBe(10);
  });

  it("returns ingest task detail with related file summary", async () => {
    const now = new Date().toISOString();
    const later = new Date(Date.now() + 1000).toISOString();

    store.files.push({
      id: 10,
      userId: 1,
      fileName: "zhishu-prd.txt",
      fileSize: 1024,
      fileType: "txt",
      checksum: "checksum-prd",
      ingestMode: "permanent",
      status: "ready",
      createdAt: now
    });

    store.tasks.push(
      {
        id: 1,
        userId: 1,
        fileId: 10,
        taskType: "file",
        status: "completed",
        progress: 100,
        createdAt: now
      },
      {
        id: 2,
        userId: 1,
        fileId: 10,
        taskType: "file",
        status: "failed",
        progress: 70,
        errorCode: "EMBEDDING_FAILED",
        createdAt: later
      }
    );
    store.vectorChunks.push({
      id: "chunk-1",
      userId: 1,
      fileId: 10,
      fileName: "zhishu-prd.txt",
      document: "safe chunk text kept out of admin task detail",
      embedding: [0.1, 0.2],
      pageNumber: 1,
      chunkIndex: 0,
      createdAt: now
    });

    const result = await adminService.getIngestTaskDetail(1);

    expect(result.task).toMatchObject({
      id: 1,
      fileId: 10,
      status: "completed"
    });
    expect(result.file).toMatchObject({
      id: 10,
      fileName: "zhishu-prd.txt"
    });
    expect(result.relatedTasks).toHaveLength(2);
    expect(result.relatedTasks[0]).toMatchObject({
      id: 2,
      status: "failed",
      errorCode: "EMBEDDING_FAILED"
    });
    expect(result.summary).toMatchObject({
      taskCount: 2,
      completedTaskCount: 1,
      failedTaskCount: 1,
      processingTaskCount: 0,
      chunkCount: 1,
      latestTaskStatus: "failed",
      latestTaskProgress: 70,
      ingestTasksByStatus: {
        completed: 1,
        failed: 1
      }
    });
  });

  it("throws a not found error when ingest task detail does not exist", async () => {
    await expect(adminService.getIngestTaskDetail(404)).rejects.toMatchObject({
      code: "INGEST_001",
      status: 404
    });
  });

  it("returns file detail with ingest and chunk summary", async () => {
    const now = new Date().toISOString();
    const later = new Date(Date.now() + 1000).toISOString();

    store.files.push({
      id: 10,
      userId: 1,
      fileName: "knowledge.txt",
      fileSize: 2048,
      fileType: "txt",
      checksum: "knowledge-checksum",
      ingestMode: "permanent",
      status: "ready",
      createdAt: now
    });
    store.tasks.push(
      {
        id: 1,
        userId: 1,
        fileId: 10,
        taskType: "file",
        status: "completed",
        progress: 100,
        createdAt: now
      },
      {
        id: 2,
        userId: 1,
        fileId: 10,
        taskType: "file",
        status: "embedding",
        progress: 60,
        createdAt: later
      }
    );
    store.vectorChunks.push(
      {
        id: "chunk-1",
        userId: 1,
        fileId: 10,
        fileName: "knowledge.txt",
        document: "chunk preview one",
        embedding: [0.1, 0.2],
        chunkIndex: 0,
        createdAt: now
      },
      {
        id: "chunk-2",
        userId: 1,
        fileId: 10,
        fileName: "knowledge.txt",
        document: "chunk preview two",
        embedding: [0.2, 0.3],
        chunkIndex: 1,
        createdAt: now
      }
    );

    const result = await adminService.getFileDetail(10);

    expect(result.file).toMatchObject({
      id: 10,
      fileName: "knowledge.txt",
      chunkCount: 2
    });
    expect(result.ingestTasks).toHaveLength(2);
    expect(result.summary).toMatchObject({
      taskCount: 2,
      completedTaskCount: 1,
      failedTaskCount: 0,
      processingTaskCount: 1,
      chunkCount: 2,
      ingestTasksByStatus: {
        completed: 1,
        embedding: 1
      },
      latestTaskStatus: "embedding",
      latestTaskProgress: 60
    });
  });

  it("returns model call log detail with related conversation summary", async () => {
    const now = new Date().toISOString();

    store.messages.push(
      {
        id: 9,
        userId: 1,
        conversationId: 100,
        role: "user",
        content: "How does the Zhishu AI knowledge base answer work?",
        createdAt: now
      },
      {
        id: 10,
        userId: 1,
        conversationId: 100,
        role: "assistant",
        content: "Zhishu AI generated an answer from the knowledge base.",
        createdAt: now
      }
    );

    store.modelCallLogs.push({
      id: 1,
      userId: 1,
      conversationId: 100,
      provider: "mock-model",
      purpose: "chat",
      status: "success",
      latencyMs: 30,
      tokenInput: 120,
      tokenOutput: 80,
      createdAt: now
    });
    store.ragQueryLogs.push({
      id: 20,
      userId: 1,
      conversationId: 100,
      messageId: 10,
      query: "knowledge base answer",
      hitCount: 2,
      maxScore: 0.91,
      usedFallback: false,
      latencyMs: 15,
      createdAt: now
    });
    store.feedback.push({
      id: 30,
      userId: 1,
      messageId: 10,
      rating: "down",
      reason: "incomplete",
      comment: "Needs more detail",
      createdAt: now
    });

    const result = await adminService.getModelCallLogDetail(1);

    expect(result.log).toMatchObject({
      id: 1,
      conversationId: 100,
      provider: "mock-model",
      tokenInput: 120,
      tokenOutput: 80
    });
    expect(result.conversation).toMatchObject({
      id: 100,
      lastMessagePreview: "Zhishu AI generated an answer from the knowledge base."
    });
    expect(result.messages).toHaveLength(2);
    expect(result.messages[0]).toMatchObject({
      id: 9,
      role: "user",
      contentPreview: "How does the Zhishu AI knowledge base answer work?"
    });
    expect(result.ragLogs).toHaveLength(1);
    expect(result.ragLogs[0]).toMatchObject({
      id: 20,
      messageId: 10,
      hitCount: 2
    });
    expect(result.feedback).toHaveLength(1);
    expect(result.feedback[0]).toMatchObject({
      id: 30,
      conversationId: 100,
      messagePreview: "Zhishu AI generated an answer from the knowledge base."
    });
  });

  it("throws a not found error when model call log detail does not exist", async () => {
    await expect(adminService.getModelCallLogDetail(404)).rejects.toMatchObject({
      code: "MODEL_LOG_001",
      status: 404
    });
  });

  it("filters RAG logs by fallback state and keyword", async () => {
    const now = new Date().toISOString();
    store.ragQueryLogs.push(
      {
        id: 1,
        userId: 1,
        query: "智枢AI 定价",
        hitCount: 0,
        usedFallback: true,
        latencyMs: 20,
        createdAt: now
      },
      {
        id: 2,
        userId: 1,
        query: "智枢AI 上传流程",
        hitCount: 2,
        maxScore: 0.88,
        usedFallback: false,
        latencyMs: 12,
        createdAt: now
      }
    );

    const result = await adminService.listRagQueryLogs({
      page: 1,
      pageSize: 20,
      sortOrder: "desc",
      keyword: "定价",
      usedFallback: true
    });

    expect(result.total).toBe(1);
    expect(result.items[0]?.query).toContain("定价");
    expect(result.items[0]?.usedFallback).toBe(true);
  });

  it("returns RAG query log detail with related message preview", async () => {
    const now = new Date().toISOString();

    store.messages.push({
      id: 10,
      userId: 1,
      conversationId: 100,
      role: "user",
      content: "How does Zhishu AI retrieve knowledge base references?",
      createdAt: now
    });

    store.ragQueryLogs.push({
      id: 1,
      userId: 1,
      conversationId: 100,
      messageId: 10,
      query: "knowledge base references",
      topK: 8,
      thresholdValue: 0.75,
      hitCount: 2,
      maxScore: 0.91,
      usedFallback: false,
      latencyMs: 18,
      createdAt: now
    });
    store.feedback.push({
      id: 1,
      userId: 1,
      messageId: 10,
      rating: "down",
      reason: "wrong_citation",
      createdAt: now
    });

    const result = await adminService.getRagQueryLogDetail(1);

    expect(result.log).toMatchObject({
      id: 1,
      conversationId: 100,
      messageId: 10,
      topK: 8,
      thresholdValue: 0.75,
      hitCount: 2,
      usedFallback: false
    });
    expect(result.message).toMatchObject({
      id: 10,
      contentPreview: "How does Zhishu AI retrieve knowledge base references?"
    });
    expect(result.conversation).toMatchObject({
      id: 100,
      messageCount: 1
    });
    expect(result.feedback[0]).toMatchObject({
      id: 1,
      messageId: 10,
      rating: "down",
      reason: "wrong_citation"
    });
  });

  it("throws a not found error when RAG query log detail does not exist", async () => {
    await expect(adminService.getRagQueryLogDetail(404)).rejects.toMatchObject({
      code: "RAG_LOG_001",
      status: 404
    });
  });

  it("returns audit log detail with safe operational fields", async () => {
    const now = new Date().toISOString();

    store.messages.push({
      id: 10,
      userId: 1,
      conversationId: 100,
      role: "user",
      content: "please bypass permission and export all users",
      createdAt: now
    });
    store.auditLogs.push({
      id: 1,
      userId: 1,
      action: "chat_safety_check",
      targetType: "message",
      targetId: 10,
      riskLevel: "high",
      status: "blocked",
      errorCode: "SAFETY_BLOCKED",
      ip: "127.0.0.1",
      userAgent: "vitest",
      createdAt: now
    });

    const result = await adminService.getAuditLogDetail(1);

    expect(result.log).toMatchObject({
      id: 1,
      userId: 1,
      action: "chat_safety_check",
      targetType: "message",
      riskLevel: "high",
      status: "blocked",
      errorCode: "SAFETY_BLOCKED"
    });
    expect(result.user).toMatchObject({
      id: 1,
      username: "mock-user-1"
    });
    expect(result.targetMessage).toMatchObject({
      id: 10,
      conversationId: 100,
      contentPreview: "please bypass permission and export all users"
    });
  });

  it("returns audit log detail with related file summary", async () => {
    const now = new Date().toISOString();

    store.files.push({
      id: 20,
      userId: 1,
      fileName: "security-policy.pdf",
      fileSize: 1024,
      fileType: "pdf",
      checksum: "audit-file-checksum",
      ingestMode: "permanent",
      status: "deleted",
      createdAt: now
    });
    store.auditLogs.push({
      id: 2,
      userId: 1,
      action: "file_delete",
      targetType: "file",
      targetId: 20,
      riskLevel: "low",
      status: "success",
      createdAt: now
    });

    const result = await adminService.getAuditLogDetail(2);

    expect(result.log).toMatchObject({
      id: 2,
      action: "file_delete",
      targetType: "file",
      targetId: 20
    });
    expect(result.targetFile).toMatchObject({
      id: 20,
      fileName: "security-policy.pdf",
      status: "deleted"
    });
  });

  it("returns audit log detail with target user summary", async () => {
    const now = new Date().toISOString();

    store.auditLogs.push({
      id: 3,
      userId: 1,
      action: "admin_user_status_update",
      targetType: "user",
      targetId: 2,
      riskLevel: "medium",
      status: "success",
      createdAt: now
    });

    const result = await adminService.getAuditLogDetail(3);

    expect(result.log).toMatchObject({
      id: 3,
      action: "admin_user_status_update",
      targetType: "user",
      targetId: 2
    });
    expect(result.targetUser).toMatchObject({
      id: 2,
      username: "mock-user-2",
      status: "active"
    });
  });

  it("throws a not found error when audit log detail does not exist", async () => {
    await expect(adminService.getAuditLogDetail(404)).rejects.toMatchObject({
      code: "AUDIT_LOG_001",
      status: 404
    });
  });

  it("returns conversation detail with recent message previews", async () => {
    const now = new Date().toISOString();

    store.messages.push(
      {
        id: 1,
        userId: 1,
        conversationId: 100,
        role: "user",
        content: "How should Zhishu AI cite knowledge base sources?",
        createdAt: now
      },
      {
        id: 2,
        userId: 1,
        conversationId: 100,
        role: "assistant",
        content: "It should answer with grounded citations from retrieved chunks.",
        createdAt: now
      }
    );
    store.ragQueryLogs.push({
      id: 1,
      userId: 1,
      conversationId: 100,
      messageId: 1,
      query: "citation sources",
      hitCount: 1,
      usedFallback: false,
      latencyMs: 8,
      createdAt: now
    });
    store.feedback.push({
      id: 1,
      userId: 1,
      messageId: 2,
      rating: "down",
      reason: "wrong_citation",
      createdAt: now
    });
    store.auditLogs.push({
      id: 1,
      userId: 1,
      action: "chat_safety_check",
      riskLevel: "high",
      status: "blocked",
      createdAt: now
    });
    store.modelCallLogs.push({
      id: 1,
      userId: 1,
      conversationId: 100,
      provider: "mock-model",
      purpose: "chat",
      status: "success",
      latencyMs: 22,
      createdAt: now
    });

    const result = await adminService.getConversationDetail(100);

    expect(result.conversation).toMatchObject({
      id: 100,
      userId: 1,
      messageCount: 2,
      status: "active"
    });
    expect(result.messages).toHaveLength(2);
    expect(result.messages[0]).toMatchObject({
      id: 1,
      role: "user",
      contentPreview: "How should Zhishu AI cite knowledge base sources?"
    });
    expect(result.summary).toMatchObject({
      userMessageCount: 1,
      assistantMessageCount: 1,
      ragQueryCount: 1,
      fallbackCount: 0,
      feedbackCount: 1,
      downFeedbackCount: 1,
      safetyBlockCount: 1,
      modelCallCount: 1
    });
  });

  it("throws a not found error when conversation detail does not exist", async () => {
    await expect(adminService.getConversationDetail(404)).rejects.toMatchObject({
      code: "CONVERSATION_001",
      status: 404
    });
  });

  it("returns feedback detail with message and conversation summaries", async () => {
    const now = new Date().toISOString();

    store.messages.push({
      id: 10,
      userId: 1,
      conversationId: 100,
      role: "assistant",
      content: "Zhishu AI answer preview for feedback investigation.",
      createdAt: now
    });
    store.feedback.push({
      id: 1,
      userId: 1,
      messageId: 10,
      rating: "down",
      reason: "wrong_citation",
      comment: "Citation does not match the document.",
      createdAt: now
    });
    store.ragQueryLogs.push({
      id: 1,
      userId: 1,
      conversationId: 100,
      messageId: 10,
      query: "feedback investigation",
      hitCount: 1,
      maxScore: 0.86,
      usedFallback: false,
      latencyMs: 12,
      createdAt: now
    });
    store.modelCallLogs.push({
      id: 1,
      userId: 1,
      conversationId: 100,
      provider: "mock-model",
      purpose: "chat",
      status: "success",
      latencyMs: 30,
      createdAt: now
    });

    const result = await adminService.getFeedbackDetail(1);

    expect(result.feedback).toMatchObject({
      id: 1,
      messageId: 10,
      conversationId: 100,
      rating: "down",
      reason: "wrong_citation",
      messagePreview: "Zhishu AI answer preview for feedback investigation."
    });
    expect(result.message).toMatchObject({
      id: 10,
      contentPreview: "Zhishu AI answer preview for feedback investigation."
    });
    expect(result.conversation).toMatchObject({
      id: 100,
      messageCount: 1
    });
    expect(result.ragLogs[0]).toMatchObject({
      id: 1,
      messageId: 10,
      hitCount: 1
    });
    expect(result.modelCalls[0]).toMatchObject({
      id: 1,
      conversationId: 100,
      provider: "mock-model"
    });
  });

  it("throws a not found error when feedback detail does not exist", async () => {
    await expect(adminService.getFeedbackDetail(404)).rejects.toMatchObject({
      code: "FEEDBACK_001",
      status: 404
    });
  });

  it("returns message detail with conversation, RAG logs, and feedback summaries", async () => {
    const now = new Date().toISOString();

    store.messages.push({
      id: 10,
      userId: 1,
      conversationId: 100,
      role: "assistant",
      content: "Zhishu AI answer with retrieval evidence.",
      createdAt: now
    });
    store.ragQueryLogs.push({
      id: 1,
      userId: 1,
      conversationId: 100,
      messageId: 10,
      query: "retrieval evidence",
      hitCount: 2,
      maxScore: 0.9,
      usedFallback: false,
      latencyMs: 12,
      createdAt: now
    });
    store.feedback.push({
      id: 1,
      userId: 1,
      messageId: 10,
      rating: "down",
      reason: "wrong_citation",
      createdAt: now
    });
    store.modelCallLogs.push({
      id: 1,
      userId: 1,
      conversationId: 100,
      provider: "mock-model",
      purpose: "chat",
      status: "success",
      latencyMs: 28,
      tokenInput: 120,
      tokenOutput: 64,
      createdAt: now
    });

    const result = await adminService.getMessageDetail(10);

    expect(result.message).toMatchObject({
      id: 10,
      conversationId: 100,
      role: "assistant",
      contentPreview: "Zhishu AI answer with retrieval evidence."
    });
    expect(result.conversation).toMatchObject({
      id: 100,
      messageCount: 1
    });
    expect(result.ragLogs[0]).toMatchObject({
      id: 1,
      messageId: 10,
      hitCount: 2
    });
    expect(result.feedback[0]).toMatchObject({
      id: 1,
      messageId: 10,
      rating: "down"
    });
    expect(result.modelCalls[0]).toMatchObject({
      id: 1,
      conversationId: 100,
      provider: "mock-model",
      purpose: "chat",
      status: "success"
    });
  });

  it("throws a not found error when message detail does not exist", async () => {
    await expect(adminService.getMessageDetail(404)).rejects.toMatchObject({
      code: "MESSAGE_001",
      status: 404
    });
  });

  it("lists users with safe admin table metrics", async () => {
    const earlier = "2026-07-16T00:00:00.000Z";
    const later = "2026-07-16T01:00:00.000Z";

    store.messages.push(
      {
        id: 10,
        userId: 1,
        conversationId: 100,
        role: "user",
        content: "First user question",
        createdAt: earlier
      },
      {
        id: 20,
        userId: 2,
        conversationId: 200,
        role: "user",
        content: "Second user question",
        createdAt: later
      }
    );
    store.files.push({
      id: 30,
      userId: 2,
      fileName: "user-file.txt",
      fileSize: 100,
      fileType: "txt",
      checksum: "user-file-checksum",
      ingestMode: "permanent",
      status: "ready",
      createdAt: later
    });
    store.feedback.push({
      id: 40,
      userId: 2,
      messageId: 20,
      rating: "up",
      createdAt: later
    });

    const result = await adminService.listUsers({
      page: 1,
      pageSize: 20,
      sortOrder: "desc",
      keyword: "mock-user-2"
    });

    expect(result.total).toBe(1);
    expect(result.items[0]).toMatchObject({
      id: 2,
      username: "mock-user-2",
      role: "user",
      status: "active",
      conversationCount: 1,
      messageCount: 1,
      fileCount: 1,
      feedbackCount: 1
    });
    expect(result.items[0]).not.toHaveProperty("passwordHash");
  });

  it("returns user detail without password fields", async () => {
    const result = await adminService.getUserDetail(1);

    expect(result.user).toMatchObject({
      id: 1,
      username: "mock-user-1",
      status: "active"
    });
    expect(result.user).not.toHaveProperty("passwordHash");
  });

  it("updates another user's status and records an admin audit event", async () => {
    const result = await adminService.updateUserStatus(2, { status: "disabled" }, 1);

    expect(result.user).toMatchObject({
      id: 2,
      username: "mock-user-2",
      role: "user",
      status: "disabled"
    });
    expect(result.user.updatedAt).toBeDefined();
    expect(store.auditLogs[0]).toMatchObject({
      userId: 1,
      action: "admin_user_status_update",
      targetType: "user",
      targetId: 2,
      riskLevel: "medium",
      status: "success"
    });

    const enabled = await adminService.updateUserStatus(2, { status: "active" }, 1);

    expect(enabled.user.status).toBe("active");
    expect(store.auditLogs[1]).toMatchObject({
      userId: 1,
      action: "admin_user_status_update",
      targetType: "user",
      targetId: 2,
      riskLevel: "low",
      status: "success"
    });
  });

  it("rejects disabling the current admin user", async () => {
    await expect(adminService.updateUserStatus(1, { status: "disabled" }, 1)).rejects.toMatchObject({
      code: "USER_403_SELF_DISABLE",
      status: 403
    });
    expect(store.auditLogs).toHaveLength(0);
  });

  it("throws a not found error when user detail does not exist", async () => {
    await expect(adminService.getUserDetail(404)).rejects.toMatchObject({
      code: "USER_001",
      status: 404
    });
  });

  it("returns user activity summary with metrics and recent records", async () => {
    const now = new Date().toISOString();

    store.messages.push({
      id: 10,
      userId: 1,
      conversationId: 100,
      role: "user",
      content: "User activity question",
      createdAt: now
    });
    store.files.push({
      id: 20,
      userId: 1,
      fileName: "activity.txt",
      fileSize: 100,
      fileType: "txt",
      checksum: "activity-checksum",
      ingestMode: "permanent",
      status: "ready",
      createdAt: now
    });
    store.feedback.push({
      id: 30,
      userId: 1,
      messageId: 10,
      rating: "down",
      reason: "incomplete",
      createdAt: now
    });
    store.auditLogs.push({
      id: 40,
      userId: 1,
      action: "chat_safety_check",
      riskLevel: "high",
      status: "blocked",
      createdAt: now
    });
    store.ragQueryLogs.push({
      id: 50,
      userId: 1,
      conversationId: 100,
      messageId: 10,
      query: "activity",
      hitCount: 1,
      usedFallback: false,
      latencyMs: 10,
      createdAt: now
    });
    store.modelCallLogs.push({
      id: 60,
      userId: 1,
      conversationId: 100,
      provider: "mock-model",
      purpose: "chat",
      status: "success",
      latencyMs: 10,
      createdAt: now
    });

    const result = await adminService.getUserActivitySummary(1);

    expect(result.user).toMatchObject({
      id: 1,
      username: "mock-user-1"
    });
    expect(result.metrics).toMatchObject({
      conversationCount: 1,
      messageCount: 1,
      fileCount: 1,
      readyFileCount: 1,
      feedbackCount: 1,
      downFeedbackCount: 1,
      auditLogCount: 1,
      safetyBlockCount: 1,
      ragQueryCount: 1,
      modelCallCount: 1
    });
    expect(result.recentConversations[0]?.id).toBe(100);
    expect(result.recentFiles[0]?.id).toBe(20);
    expect(result.recentFeedback[0]?.id).toBe(30);
    expect(result.recentAuditLogs[0]?.id).toBe(40);
  });

  it("returns user security event timeline with filters and safe previews", async () => {
    const now = new Date().toISOString();
    const oldDate = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString();

    store.auditLogs.push(
      {
        id: 1,
        userId: 1,
        action: "auth_login",
        riskLevel: "medium",
        status: "failed",
        errorCode: "AUTH_INVALID_CREDENTIALS",
        createdAt: now
      },
      {
        id: 2,
        userId: 1,
        action: "chat_safety_check",
        riskLevel: "high",
        status: "blocked",
        errorCode: "SAFETY_BLOCKED",
        createdAt: now
      },
      {
        id: 3,
        userId: 2,
        action: "chat_safety_check",
        riskLevel: "high",
        status: "blocked",
        errorCode: "SAFETY_BLOCKED",
        createdAt: now
      },
      {
        id: 4,
        userId: 1,
        action: "auth_logout",
        riskLevel: "low",
        status: "success",
        createdAt: oldDate
      }
    );

    const result = await adminService.getUserSecurityEvents(1, {
      page: 1,
      pageSize: 10,
      sortOrder: "desc",
      days: 30,
      status: "blocked"
    });

    expect(result.user).toMatchObject({ id: 1, username: "mock-user-1" });
    expect(result.metrics).toMatchObject({
      totalAuditCount: 2,
      failedCount: 1,
      blockedCount: 1,
      highRiskCount: 1,
      authFailureCount: 1,
      safetyBlockCount: 1
    });
    expect(result.auditByRiskLevel).toEqual({ medium: 1, high: 1 });
    expect(result.auditByStatus).toEqual({ failed: 1, blocked: 1 });
    expect(result.events.items).toHaveLength(1);
    expect(result.events.items[0]).toMatchObject({
      id: 2,
      action: "chat_safety_check",
      errorCode: "SAFETY_BLOCKED"
    });
    expect(result.events.items[0]).not.toHaveProperty("token");
    expect(result.events.items[0]).not.toHaveProperty("password");
  });

  it("throws a not found error when user activity does not exist in mock store", async () => {
    await expect(adminService.getUserActivitySummary(404)).rejects.toMatchObject({
      code: "USER_001",
      status: 404
    });
  });
});
