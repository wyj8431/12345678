import type { Context } from "koa";
import { env } from "../config/env.js";
import { store } from "../mocks/in-memory-store.js";
import type { AuditLog, ChatMessage, IngestTask, KnowledgeFile, ModelCallLog, RagQueryLog } from "../mocks/in-memory-store.js";
import { adminRepository } from "../repositories/admin.repository.js";
import type {
  AdminAuditLogQuery,
  AdminAuditLogDetail,
  AdminAuditLogItem,
  AdminBaseListQuery,
  AdminConversationDetail,
  AdminConversationListItem,
  AdminConversationQuery,
  AdminConversationActivitySummary,
  AdminDashboardBreakdownQuery,
  AdminDashboardBreakdowns,
  AdminFileActivitySummary,
  AdminDashboardTrendQuery,
  AdminDashboardTrends,
  AdminFileDetail,
  AdminFileIngestTaskItem,
  AdminFileListItem,
  AdminFileQuery,
  AdminFeedbackDetail,
  AdminFeedbackListItem,
  AdminFeedbackQuery,
  AdminIngestTaskDetail,
  AdminIngestTaskQuery,
  AdminModelCallLogDetail,
  AdminModelCallLogItem,
  AdminMessageDetail,
  AdminMessageListItem,
  AdminMessageQuery,
  AdminModelCallLogQuery,
  AdminRagQueryLogDetail,
  AdminRagQueryLogItem,
  AdminRagQueryLogQuery,
  AdminSecurityOverview,
  AdminSecurityOverviewQuery,
  AdminUserActivitySummary,
  AdminUserDetail,
  AdminUserListItem,
  AdminUserQuery,
  AdminUserSecurityEventQuery,
  AdminUserSecurityEvents,
  AdminUserSummary,
  AdminUserStatusUpdateRequest,
  AdminUserStatusUpdateResponse,
  PaginatedResult
} from "../schemas/admin.schema.js";
import { auditService } from "./audit.service.js";
import { AppError } from "../utils/errors.js";

function todayPrefix() {
  return new Date().toISOString().slice(0, 10);
}

function isToday(item: { createdAt: string }) {
  return item.createdAt.startsWith(todayPrefix());
}

function dateKey(value: string) {
  return value.slice(0, 10);
}

function recentDateKeys(days: number) {
  const keys: string[] = [];
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  for (let index = days - 1; index >= 0; index -= 1) {
    const date = new Date(today);
    date.setUTCDate(today.getUTCDate() - index);
    keys.push(date.toISOString().slice(0, 10));
  }

  return keys;
}

function isWithinRecentDays(value: string, days: number) {
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  start.setUTCDate(start.getUTCDate() - days + 1);
  return Date.parse(value) >= start.getTime();
}

function paginate<T>(items: T[], query: AdminBaseListQuery): PaginatedResult<T> {
  const total = items.length;
  const start = (query.page - 1) * query.pageSize;
  const totalPages = Math.max(1, Math.ceil(total / query.pageSize));

  return {
    items: items.slice(start, start + query.pageSize),
    total,
    page: query.page,
    pageSize: query.pageSize,
    totalPages
  };
}

function applyBaseFilters<T extends { createdAt: string; userId?: number }>(items: T[], query: AdminBaseListQuery) {
  return items
    .filter((item) => query.userId === undefined || item.userId === query.userId)
    .filter((item) => query.createdFrom === undefined || Date.parse(item.createdAt) >= Date.parse(query.createdFrom))
    .filter((item) => query.createdTo === undefined || Date.parse(item.createdAt) <= Date.parse(query.createdTo))
    .sort((left, right) => {
      const diff = Date.parse(left.createdAt) - Date.parse(right.createdAt);
      return query.sortOrder === "asc" ? diff : -diff;
    });
}

function matchesKeyword(keyword: string | undefined, ...values: Array<string | number | boolean | undefined>) {
  if (!keyword) return true;
  const normalizedKeyword = keyword.toLowerCase();
  return values.some((value) => String(value ?? "").toLowerCase().includes(normalizedKeyword));
}

function countBy<T>(items: T[], key: (item: T) => string | undefined) {
  return items.reduce<Record<string, number>>((acc, item) => {
    const value = key(item) ?? "unknown";
    acc[value] = (acc[value] ?? 0) + 1;
    return acc;
  }, {});
}

function preview(content: string | undefined) {
  if (!content) return undefined;
  return content.length > 180 ? `${content.slice(0, 180)}...` : content;
}

function buildMockConversations(): AdminConversationListItem[] {
  const grouped = new Map<number, ChatMessage[]>();

  for (const message of store.messages) {
    const messages = grouped.get(message.conversationId) ?? [];
    messages.push(message);
    grouped.set(message.conversationId, messages);
  }

  return [...grouped.entries()].map(([conversationId, messages]) => {
    const sortedMessages = [...messages].sort((left, right) => Date.parse(left.createdAt) - Date.parse(right.createdAt));
    const firstMessage = sortedMessages[0];
    const lastMessage = sortedMessages.at(-1);
    const titleSource = sortedMessages.find((message) => message.role === "user") ?? firstMessage;

    return {
      id: conversationId,
      userId: firstMessage?.userId ?? 0,
      title: preview(titleSource?.content),
      status: "active",
      messageCount: sortedMessages.length,
      lastMessageAt: lastMessage?.createdAt,
      lastMessagePreview: preview(lastMessage?.content),
      createdAt: firstMessage?.createdAt ?? new Date(0).toISOString(),
      updatedAt: lastMessage?.createdAt ?? firstMessage?.createdAt ?? new Date(0).toISOString()
    };
  });
}

function buildConversationActivitySummary(
  messages: ChatMessage[],
  userId: number,
  conversationId: number
): AdminConversationActivitySummary {
  const ragLogs = store.ragQueryLogs.filter((log) => log.userId === userId && log.conversationId === conversationId);
  const feedback = store.feedback.filter((item) => {
    if (item.userId !== userId) return false;
    const message = store.messages.find((entry) => entry.id === item.messageId && entry.userId === userId);
    return message?.conversationId === conversationId;
  });
  const auditLogs = store.auditLogs.filter((item) => item.userId === userId);
  const modelLogs = store.modelCallLogs.filter((item) => item.userId === userId && item.conversationId === conversationId);

  return {
    userMessageCount: messages.filter((message) => message.role === "user").length,
    assistantMessageCount: messages.filter((message) => message.role === "assistant").length,
    ragQueryCount: ragLogs.length,
    fallbackCount: ragLogs.filter((log) => log.usedFallback).length,
    feedbackCount: feedback.length,
    downFeedbackCount: feedback.filter((item) => item.rating === "down").length,
    safetyBlockCount: auditLogs.filter((item) => item.status === "blocked").length,
    modelCallCount: modelLogs.length,
    lastUserMessageAt: maxDate(...messages.filter((message) => message.role === "user").map((message) => message.createdAt)),
    lastAssistantMessageAt: maxDate(...messages.filter((message) => message.role === "assistant").map((message) => message.createdAt)),
    lastRagQueryAt: maxDate(...ragLogs.map((log) => log.createdAt)),
    lastFeedbackAt: maxDate(...feedback.map((item) => item.createdAt)),
    lastSafetyBlockAt: maxDate(...auditLogs.filter((item) => item.status === "blocked").map((item) => item.createdAt)),
    lastModelCallAt: maxDate(...modelLogs.map((item) => item.createdAt))
  };
}

function toAdminFileListItem(file: KnowledgeFile): AdminFileListItem {
  return {
    id: file.id,
    userId: file.userId,
    fileName: file.fileName,
    fileSize: file.fileSize,
    fileType: file.fileType,
    checksum: file.checksum,
    ingestMode: file.ingestMode,
    status: file.status,
    chunkCount: store.vectorChunks.filter((chunk) => chunk.fileId === file.id).length,
    createdAt: file.createdAt,
    updatedAt: file.createdAt
  };
}

function buildFileActivitySummary(fileId: number, tasks: IngestTask[]): AdminFileActivitySummary {
  const sortedTasks = [...tasks].sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt));
  const latestTask = sortedTasks[0];

  return {
    taskCount: tasks.length,
    completedTaskCount: tasks.filter((task) => task.status === "completed").length,
    failedTaskCount: tasks.filter((task) => task.status === "failed").length,
    processingTaskCount: tasks.filter((task) => task.status !== "completed" && task.status !== "failed").length,
    chunkCount: store.vectorChunks.filter((chunk) => chunk.fileId === fileId).length,
    ingestTasksByStatus: countBy(tasks, (task) => task.status),
    latestTaskStatus: latestTask?.status,
    latestTaskProgress: latestTask?.progress,
    lastTaskAt: maxDate(...tasks.map((task) => task.createdAt)),
    lastCompletedAt: maxDate(...tasks.filter((task) => task.status === "completed").map((task) => task.createdAt)),
    lastFailedAt: maxDate(...tasks.filter((task) => task.status === "failed").map((task) => task.createdAt))
  };
}

function toAdminFileTaskItem(task: IngestTask): AdminFileIngestTaskItem {
  return {
    id: task.id,
    userId: task.userId,
    fileId: task.fileId,
    taskType: task.taskType,
    status: task.status,
    progress: task.progress,
    errorCode: task.errorCode,
    errorMessage: task.errorMessage,
    createdAt: task.createdAt
  };
}

function toAdminMessageListItem(message: ChatMessage): AdminMessageListItem {
  return {
    id: message.id,
    userId: message.userId,
    conversationId: message.conversationId,
    role: message.role,
    contentPreview: preview(message.content) ?? "",
    createdAt: message.createdAt
  };
}

function toAdminRagQueryLogItem(log: RagQueryLog): AdminRagQueryLogItem {
  return {
    id: log.id,
    userId: log.userId,
    conversationId: log.conversationId,
    messageId: log.messageId,
    query: log.query,
    rewrittenQuery: log.rewrittenQuery,
    topK: log.topK,
    thresholdValue: log.thresholdValue,
    hitCount: log.hitCount,
    maxScore: log.maxScore,
    usedFallback: log.usedFallback,
    latencyMs: log.latencyMs,
    createdAt: log.createdAt
  };
}

function toAdminModelCallLogItem(log: ModelCallLog): AdminModelCallLogItem {
  return {
    id: log.id,
    userId: log.userId,
    conversationId: log.conversationId,
    provider: log.provider,
    purpose: log.purpose,
    status: log.status,
    latencyMs: log.latencyMs,
    tokenInput: log.tokenInput,
    tokenOutput: log.tokenOutput,
    errorCode: log.errorCode,
    createdAt: log.createdAt
  };
}

function toAdminAuditLogItem(log: AuditLog): AdminAuditLogItem {
  return {
    id: log.id,
    userId: log.userId,
    action: log.action,
    targetType: log.targetType,
    targetId: log.targetId,
    riskLevel: log.riskLevel,
    status: log.status,
    errorCode: log.errorCode,
    ip: log.ip,
    userAgent: log.userAgent,
    createdAt: log.createdAt
  };
}

function maxDate(...values: Array<string | undefined>) {
  const timestamps = values.map((value) => (value === undefined ? Number.NaN : Date.parse(value))).filter(Number.isFinite);
  if (timestamps.length === 0) return undefined;
  return new Date(Math.max(...timestamps)).toISOString();
}

function collectMockUserIds() {
  const userIds = new Set<number>();
  userIds.add(env.DEFAULT_USER_ID);
  for (const item of store.mockUsers) userIds.add(item.id);
  for (const item of store.messages) userIds.add(item.userId);
  for (const item of store.files) userIds.add(item.userId);
  for (const item of store.feedback) userIds.add(item.userId);
  for (const item of store.auditLogs) {
    if (item.userId !== undefined) userIds.add(item.userId);
  }
  for (const item of store.ragQueryLogs) userIds.add(item.userId);
  for (const item of store.modelCallLogs) userIds.add(item.userId);

  return [...userIds];
}

function buildMockUserSummary(userId: number): AdminUserSummary {
  const explicitUser = store.mockUsers.find((user) => user.id === userId);
  const activityCreatedAt = [
    ...store.messages,
    ...store.files,
    ...store.feedback,
    ...store.auditLogs,
    ...store.ragQueryLogs,
    ...store.modelCallLogs
  ]
    .filter((item) => item.userId === userId)
    .map((item) => item.createdAt);
  const createdAt = [explicitUser?.createdAt, ...activityCreatedAt]
    .filter((value): value is string => value !== undefined)
    .sort((left, right) => Date.parse(left) - Date.parse(right))[0];

  return {
    id: userId,
    username: explicitUser?.username ?? `mock-user-${userId}`,
    role: explicitUser?.role ?? (userId === env.DEFAULT_USER_ID ? env.DEFAULT_USER_ROLE : "user"),
    status: explicitUser?.status ?? "active",
    createdAt,
    updatedAt: maxDate(
      explicitUser?.updatedAt,
      ...store.messages.filter((item) => item.userId === userId).map((item) => item.createdAt),
      ...store.files.filter((item) => item.userId === userId).map((item) => item.createdAt),
      ...store.feedback.filter((item) => item.userId === userId).map((item) => item.createdAt),
      ...store.auditLogs.filter((item) => item.userId === userId).map((item) => item.createdAt),
      ...store.ragQueryLogs.filter((item) => item.userId === userId).map((item) => item.createdAt),
      ...store.modelCallLogs.filter((item) => item.userId === userId).map((item) => item.createdAt)
    )
  };
}

function buildMockUserListItem(userId: number): AdminUserListItem {
  const conversations = buildMockConversations().filter((conversation) => conversation.userId === userId);
  const user = buildMockUserSummary(userId);
  return {
    ...user,
    conversationCount: conversations.length,
    messageCount: store.messages.filter((message) => message.userId === userId).length,
    fileCount: store.files.filter((file) => file.userId === userId).length,
    feedbackCount: store.feedback.filter((feedback) => feedback.userId === userId).length,
    lastActiveAt: maxDate(
      user.updatedAt,
      ...conversations.map((conversation) => conversation.updatedAt),
      ...store.auditLogs.filter((log) => log.userId === userId).map((log) => log.createdAt),
      ...store.ragQueryLogs.filter((log) => log.userId === userId).map((log) => log.createdAt),
      ...store.modelCallLogs.filter((log) => log.userId === userId).map((log) => log.createdAt)
    )
  };
}

export const adminService = {
  async getDashboardMetrics() {
    if (!env.USE_MOCK_DB) {
      const [
        chatCount,
        modelCallCount,
        ragHitRate,
        fallbackRate,
        ingestSuccessRate,
        safetyBlockCount,
        feedbackStats
      ] = await Promise.all([
        adminRepository.countTodayMessages(),
        adminRepository.countTodayModelCalls(),
        adminRepository.getRagHitRate(),
        adminRepository.getFallbackRate(),
        adminRepository.getIngestSuccessRate(),
        adminRepository.countTodaySafetyBlocks(),
        adminRepository.getFeedbackStats()
      ]);

      return {
        chatCount,
        modelCallCount,
        ragHitRate,
        fallbackRate,
        ingestSuccessRate,
        safetyBlockCount,
        feedbackStats
      };
    }

    const todayMessages = store.messages.filter(isToday);
    const todayModelCalls = store.modelCallLogs.filter(isToday);
    const ragLogs = store.ragQueryLogs;
    const tasks = store.tasks;
    const feedbackDown = store.feedback.filter((item) => item.rating === "down");

    const ragHitRate =
      ragLogs.length === 0 ? 0 : ragLogs.filter((log) => log.hitCount > 0).length / ragLogs.length;
    const fallbackRate =
      ragLogs.length === 0 ? 0 : ragLogs.filter((log) => log.usedFallback).length / ragLogs.length;
    const ingestSuccessRate =
      tasks.length === 0 ? 0 : tasks.filter((task) => task.status === "completed").length / tasks.length;

    return {
      chatCount: todayMessages.filter((message) => message.role === "user").length,
      modelCallCount: todayModelCalls.length,
      ragHitRate,
      fallbackRate,
      ingestSuccessRate,
      safetyBlockCount: store.auditLogs.filter((log) => log.status === "blocked" && isToday(log)).length,
      feedbackStats: {
        up: store.feedback.filter((item) => item.rating === "up").length,
        down: feedbackDown.length,
        downReasons: feedbackDown.reduce<Record<string, number>>((acc, item) => {
          const key = item.reason ?? "unknown";
          acc[key] = (acc[key] ?? 0) + 1;
          return acc;
        }, {})
      }
    };
  },

  async getDashboardTrends(query: AdminDashboardTrendQuery): Promise<AdminDashboardTrends> {
    if (!env.USE_MOCK_DB) return adminRepository.getDashboardTrends(query);

    const points = recentDateKeys(query.days).map((date) => {
      const messages = store.messages.filter((item) => dateKey(item.createdAt) === date && item.role === "user");
      const modelCalls = store.modelCallLogs.filter((item) => dateKey(item.createdAt) === date);
      const ragLogs = store.ragQueryLogs.filter((item) => dateKey(item.createdAt) === date);
      const fallbackCount = ragLogs.filter((item) => item.usedFallback).length;
      const safetyBlockCount = store.auditLogs.filter((item) => dateKey(item.createdAt) === date && item.status === "blocked").length;
      const feedbackCount = store.feedback.filter((item) => dateKey(item.createdAt) === date).length;
      const modelLatencyTotal = modelCalls.reduce((total, item) => total + item.latencyMs, 0);

      return {
        date,
        chatCount: messages.length,
        modelCallCount: modelCalls.length,
        avgModelLatencyMs: modelCalls.length === 0 ? 0 : Math.round(modelLatencyTotal / modelCalls.length),
        ragQueryCount: ragLogs.length,
        fallbackCount,
        fallbackRate: ragLogs.length === 0 ? 0 : fallbackCount / ragLogs.length,
        safetyBlockCount,
        feedbackCount
      };
    });

    return {
      days: query.days,
      points: points.filter((point) => isWithinRecentDays(`${point.date}T00:00:00.000Z`, query.days))
    };
  },

  async getDashboardBreakdowns(query: AdminDashboardBreakdownQuery): Promise<AdminDashboardBreakdowns> {
    if (!env.USE_MOCK_DB) return adminRepository.getDashboardBreakdowns(query);

    const files = store.files.filter((item) => isWithinRecentDays(item.createdAt, query.days));
    const tasks = store.tasks.filter((item) => isWithinRecentDays(item.createdAt, query.days));
    const modelLogs = store.modelCallLogs.filter((item) => isWithinRecentDays(item.createdAt, query.days));
    const ragLogs = store.ragQueryLogs.filter((item) => isWithinRecentDays(item.createdAt, query.days));
    const feedback = store.feedback.filter((item) => isWithinRecentDays(item.createdAt, query.days));
    const auditLogs = store.auditLogs.filter((item) => isWithinRecentDays(item.createdAt, query.days));

    return {
      days: query.days,
      filesByStatus: countBy(files, (file) => file.status),
      ingestTasksByStatus: countBy(tasks, (task) => task.status),
      modelCallsByStatus: countBy(modelLogs, (log) => log.status),
      modelCallsByPurpose: countBy(modelLogs, (log) => log.purpose),
      ragFallback: {
        fallback: ragLogs.filter((log) => log.usedFallback).length,
        nonFallback: ragLogs.filter((log) => !log.usedFallback).length
      },
      feedbackByRating: countBy(feedback, (item) => item.rating),
      feedbackDownReasons: countBy(
        feedback.filter((item) => item.rating === "down"),
        (item) => item.reason
      ),
      auditByRiskLevel: countBy(auditLogs, (log) => log.riskLevel),
      auditByStatus: countBy(auditLogs, (log) => log.status)
    };
  },

  async getSecurityOverview(query: AdminSecurityOverviewQuery): Promise<AdminSecurityOverview> {
    if (!env.USE_MOCK_DB) return adminRepository.getSecurityOverview(query);

    const auditLogs = store.auditLogs.filter((item) => isWithinRecentDays(item.createdAt, query.days));
    const authFailureActions = new Set(["auth_login", "auth_required", "auth_authorization_header", "auth_token_verify"]);
    const topActions = Object.entries(
      auditLogs.reduce<Record<string, AuditLog[]>>((acc, log) => {
        acc[log.action] = [...(acc[log.action] ?? []), log];
        return acc;
      }, {})
    )
      .map(([action, logs]) => ({
        action,
        count: logs.length,
        failedCount: logs.filter((log) => log.status === "failed").length,
        blockedCount: logs.filter((log) => log.status === "blocked").length,
        lastSeenAt: maxDate(...logs.map((log) => log.createdAt))
      }))
      .sort((left, right) => right.count - left.count || (right.lastSeenAt ?? "").localeCompare(left.lastSeenAt ?? ""))
      .slice(0, 10);
    const uniqueUserIds = new Set(auditLogs.map((log) => log.userId).filter((userId) => userId !== undefined));

    return {
      days: query.days,
      totalAuditCount: auditLogs.length,
      successCount: auditLogs.filter((log) => log.status === "success").length,
      failedCount: auditLogs.filter((log) => log.status === "failed").length,
      blockedCount: auditLogs.filter((log) => log.status === "blocked").length,
      highRiskCount: auditLogs.filter((log) => log.riskLevel === "high").length,
      authFailureCount: auditLogs.filter((log) => authFailureActions.has(log.action) && log.status !== "success").length,
      permissionDeniedCount: auditLogs.filter((log) => log.action === "rbac_permission_denied").length,
      safetyBlockCount: auditLogs.filter((log) => log.status === "blocked" || log.errorCode === "SAFETY_BLOCKED").length,
      uniqueUserCount: uniqueUserIds.size,
      auditByRiskLevel: countBy(auditLogs, (log) => log.riskLevel),
      auditByStatus: countBy(auditLogs, (log) => log.status),
      topActions,
      recentHighRiskLogs: auditLogs
        .filter((log) => log.riskLevel === "high" || log.status === "blocked")
        .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))
        .slice(0, 10)
        .map<AdminAuditLogItem>(toAdminAuditLogItem)
    };
  },

  async listUsers(query: AdminUserQuery): Promise<PaginatedResult<AdminUserListItem>> {
    if (!env.USE_MOCK_DB) return adminRepository.listUsers(query);

    const items = collectMockUserIds()
      .map(buildMockUserListItem)
      .filter((user) => query.role === undefined || user.role === query.role)
      .filter((user) => query.status === undefined || user.status === query.status)
      .filter((user) => query.createdFrom === undefined || Date.parse(user.createdAt ?? "") >= Date.parse(query.createdFrom))
      .filter((user) => query.createdTo === undefined || Date.parse(user.createdAt ?? "") <= Date.parse(query.createdTo))
      .filter((user) => matchesKeyword(query.keyword, user.id, user.username, user.role, user.status))
      .sort((left, right) => {
        const diff = Date.parse(left.createdAt ?? left.lastActiveAt ?? "") - Date.parse(right.createdAt ?? right.lastActiveAt ?? "");
        return query.sortOrder === "asc" ? diff : -diff;
      });

    return paginate<AdminUserListItem>(items, query);
  },

  async getUserDetail(userId: number): Promise<AdminUserDetail> {
    if (!env.USE_MOCK_DB) {
      const user = await adminRepository.getUserDetail(userId);
      if (!user) throw new AppError("USER_001", "User not found", 404);
      return { user };
    }

    if (!collectMockUserIds().includes(userId)) throw new AppError("USER_001", "User not found", 404);
    return { user: buildMockUserSummary(userId) };
  },

  async updateUserStatus(
    userId: number,
    input: AdminUserStatusUpdateRequest,
    actorUserId: number,
    ctx?: Context
  ): Promise<AdminUserStatusUpdateResponse> {
    if (userId === actorUserId && input.status === "disabled") {
      throw new AppError("USER_403_SELF_DISABLE", "Cannot disable current admin user", 403);
    }

    if (!env.USE_MOCK_DB) {
      const existingUser = await adminRepository.getUserDetail(userId);
      if (!existingUser) throw new AppError("USER_001", "User not found", 404);
      if (existingUser.status === input.status) return { user: existingUser };

      const user = await adminRepository.updateUserStatus(userId, input.status);
      if (!user) throw new AppError("USER_001", "User not found", 404);

      await auditService.record({
        userId: actorUserId,
        action: "admin_user_status_update",
        targetType: "user",
        targetId: userId,
        riskLevel: input.status === "disabled" ? "medium" : "low",
        status: "success",
        ctx
      });

      return { user };
    }

    if (!collectMockUserIds().includes(userId)) throw new AppError("USER_001", "User not found", 404);

    const currentUser = buildMockUserSummary(userId);
    if (currentUser.status === input.status) return { user: currentUser };

    const now = new Date().toISOString();
    const explicitUserIndex = store.mockUsers.findIndex((user) => user.id === userId);
    const nextUser = {
      id: userId,
      username: currentUser.username,
      role: currentUser.role ?? "user",
      status: input.status,
      createdAt: currentUser.createdAt ?? now,
      updatedAt: now
    };

    if (explicitUserIndex >= 0) {
      store.mockUsers[explicitUserIndex] = nextUser;
    } else {
      store.mockUsers.push(nextUser);
    }

    await auditService.record({
      userId: actorUserId,
      action: "admin_user_status_update",
      targetType: "user",
      targetId: userId,
      riskLevel: input.status === "disabled" ? "medium" : "low",
      status: "success",
      ctx
    });

    return { user: buildMockUserSummary(userId) };
  },

  async getUserActivitySummary(userId: number): Promise<AdminUserActivitySummary> {
    if (!env.USE_MOCK_DB) {
      const summary = await adminRepository.getUserActivitySummary(userId);
      if (!summary) throw new AppError("USER_001", "User not found", 404);
      return summary;
    }

    const hasActivity = [
      store.messages,
      store.files,
      store.feedback,
      store.auditLogs,
      store.ragQueryLogs,
      store.modelCallLogs
    ].some((items) => items.some((item) => item.userId === userId));
    if (!hasActivity && !collectMockUserIds().includes(userId)) throw new AppError("USER_001", "User not found", 404);

    const userConversations = buildMockConversations().filter((conversation) => conversation.userId === userId);
    const recentConversations = userConversations
      .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt))
      .slice(0, 5);
    const recentFiles = store.files
      .filter((file) => file.userId === userId)
      .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))
      .slice(0, 5)
      .map<AdminFileListItem>(toAdminFileListItem);
    const recentFeedback = store.feedback
      .filter((feedback) => feedback.userId === userId)
      .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))
      .slice(0, 5)
      .map<AdminFeedbackListItem>((feedback) => {
        const message = store.messages.find((item) => item.id === feedback.messageId && item.userId === feedback.userId);
        return {
          ...feedback,
          conversationId: message?.conversationId,
          messagePreview: preview(message?.content)
        };
      });
    const recentAuditLogs = store.auditLogs
      .filter((log) => log.userId === userId)
      .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))
      .slice(0, 5)
      .map<AdminAuditLogItem>(toAdminAuditLogItem);

    return {
      user: buildMockUserSummary(userId),
      metrics: {
        conversationCount: userConversations.length,
        messageCount: store.messages.filter((message) => message.userId === userId).length,
        fileCount: store.files.filter((file) => file.userId === userId).length,
        readyFileCount: store.files.filter((file) => file.userId === userId && file.status === "ready").length,
        feedbackCount: store.feedback.filter((feedback) => feedback.userId === userId).length,
        downFeedbackCount: store.feedback.filter((feedback) => feedback.userId === userId && feedback.rating === "down").length,
        auditLogCount: store.auditLogs.filter((log) => log.userId === userId).length,
        safetyBlockCount: store.auditLogs.filter((log) => log.userId === userId && log.status === "blocked").length,
        ragQueryCount: store.ragQueryLogs.filter((log) => log.userId === userId).length,
        modelCallCount: store.modelCallLogs.filter((log) => log.userId === userId).length
      },
      recentConversations,
      recentFiles,
      recentFeedback,
      recentAuditLogs
    };
  },

  async getUserSecurityEvents(userId: number, query: AdminUserSecurityEventQuery): Promise<AdminUserSecurityEvents> {
    if (!env.USE_MOCK_DB) {
      const result = await adminRepository.getUserSecurityEvents(userId, query);
      if (!result) throw new AppError("USER_001", "User not found", 404);
      return result;
    }

    if (!collectMockUserIds().includes(userId)) throw new AppError("USER_001", "User not found", 404);

    const scopedLogs = store.auditLogs
      .filter((log) => log.userId === userId)
      .filter((log) => isWithinRecentDays(log.createdAt, query.days));
    const filteredLogs = scopedLogs
      .filter((log) => query.action === undefined || log.action === query.action)
      .filter((log) => query.riskLevel === undefined || log.riskLevel === query.riskLevel)
      .filter((log) => query.status === undefined || log.status === query.status)
      .filter((log) =>
        matchesKeyword(query.keyword, log.id, log.action, log.targetType, log.riskLevel, log.status, log.errorCode)
      )
      .sort((left, right) => {
        const diff = Date.parse(left.createdAt) - Date.parse(right.createdAt);
        return query.sortOrder === "asc" ? diff : -diff;
      })
      .map<AdminAuditLogItem>(toAdminAuditLogItem);
    const authFailureActions = new Set(["auth_login", "auth_required", "auth_authorization_header", "auth_token_verify"]);

    return {
      user: buildMockUserSummary(userId),
      days: query.days,
      metrics: {
        totalAuditCount: scopedLogs.length,
        successCount: scopedLogs.filter((log) => log.status === "success").length,
        failedCount: scopedLogs.filter((log) => log.status === "failed").length,
        blockedCount: scopedLogs.filter((log) => log.status === "blocked").length,
        highRiskCount: scopedLogs.filter((log) => log.riskLevel === "high").length,
        authFailureCount: scopedLogs.filter((log) => authFailureActions.has(log.action) && log.status !== "success").length,
        permissionDeniedCount: scopedLogs.filter((log) => log.action === "rbac_permission_denied").length,
        safetyBlockCount: scopedLogs.filter((log) => log.status === "blocked" || log.errorCode === "SAFETY_BLOCKED").length,
        lastEventAt: maxDate(...scopedLogs.map((log) => log.createdAt))
      },
      auditByRiskLevel: countBy(scopedLogs, (log) => log.riskLevel),
      auditByStatus: countBy(scopedLogs, (log) => log.status),
      events: paginate<AdminAuditLogItem>(filteredLogs, query)
    };
  },

  async listIngestTasks(query: AdminIngestTaskQuery) {
    if (!env.USE_MOCK_DB) return adminRepository.listIngestTasks(query);

    const items = applyBaseFilters(store.tasks, query)
      .filter((task) => query.status === undefined || task.status === query.status)
      .filter((task) => query.taskType === undefined || task.taskType === query.taskType)
      .filter((task) => query.fileId === undefined || task.fileId === query.fileId)
      .filter((task) =>
        matchesKeyword(query.keyword, task.id, task.fileId, task.taskType, task.status, task.errorCode, task.errorMessage)
      );

    return paginate<IngestTask>(items, query);
  },

  async getIngestTaskDetail(taskId: number): Promise<AdminIngestTaskDetail> {
    if (!env.USE_MOCK_DB) {
      const detail = await adminRepository.getIngestTaskDetail(taskId);
      if (!detail) throw new AppError("INGEST_001", "Ingest task not found", 404);
      return detail;
    }

    const task = store.tasks.find((item) => item.id === taskId);
    if (!task) throw new AppError("INGEST_001", "Ingest task not found", 404);

    const file = store.files.find((item) => item.id === task.fileId);
    const relatedTasks = store.tasks
      .filter((item) => item.fileId === task.fileId && item.userId === task.userId)
      .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))
      .map<AdminFileIngestTaskItem>(toAdminFileTaskItem);

    return {
      task: toAdminFileTaskItem(task),
      file: file ? toAdminFileListItem(file) : undefined,
      relatedTasks,
      summary: buildFileActivitySummary(task.fileId, relatedTasks)
    };
  },

  async listModelCallLogs(query: AdminModelCallLogQuery) {
    if (!env.USE_MOCK_DB) return adminRepository.listModelCallLogs(query);

    const items = applyBaseFilters(store.modelCallLogs, query)
      .filter((log) => query.provider === undefined || log.provider === query.provider)
      .filter((log) => query.purpose === undefined || log.purpose === query.purpose)
      .filter((log) => query.status === undefined || log.status === query.status)
      .filter((log) => matchesKeyword(query.keyword, log.id, log.provider, log.purpose, log.status));

    return paginate<ModelCallLog>(items, query);
  },

  async getModelCallLogDetail(logId: number): Promise<AdminModelCallLogDetail> {
    if (!env.USE_MOCK_DB) {
      const detail = await adminRepository.getModelCallLogDetail(logId);
      if (!detail) throw new AppError("MODEL_LOG_001", "Model call log not found", 404);
      return detail;
    }

    const log = store.modelCallLogs.find((item) => item.id === logId);
    if (!log) throw new AppError("MODEL_LOG_001", "Model call log not found", 404);

    const conversation =
      log.conversationId === undefined ? undefined : buildMockConversations().find((item) => item.id === log.conversationId);
    const conversationMessages =
      log.conversationId === undefined
        ? []
        : store.messages
            .filter((message) => message.userId === log.userId && message.conversationId === log.conversationId)
            .sort((left, right) => Date.parse(left.createdAt) - Date.parse(right.createdAt));
    const messages = conversationMessages.slice(0, 20).map<AdminMessageListItem>(toAdminMessageListItem);
    const messageIds = new Set(conversationMessages.map((message) => message.id));
    const ragLogs =
      log.conversationId === undefined
        ? []
        : store.ragQueryLogs
            .filter((item) => item.userId === log.userId && item.conversationId === log.conversationId)
            .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))
            .slice(0, 20)
            .map<AdminRagQueryLogItem>(toAdminRagQueryLogItem);
    const feedback =
      log.conversationId === undefined
        ? []
        : store.feedback
            .filter((item) => item.userId === log.userId && messageIds.has(item.messageId))
            .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))
            .slice(0, 20)
            .map<AdminFeedbackListItem>((item) => {
              const message = store.messages.find((entry) => entry.id === item.messageId && entry.userId === item.userId);
              return {
                ...item,
                conversationId: message?.conversationId,
                messagePreview: preview(message?.content)
              };
            });

    return {
      log: toAdminModelCallLogItem(log),
      conversation,
      messages,
      ragLogs,
      feedback
    };
  },

  async listRagQueryLogs(query: AdminRagQueryLogQuery) {
    if (!env.USE_MOCK_DB) return adminRepository.listRagQueryLogs(query);

    const items = applyBaseFilters(store.ragQueryLogs, query)
      .filter((log) => query.usedFallback === undefined || log.usedFallback === query.usedFallback)
      .filter((log) => matchesKeyword(query.keyword, log.id, log.query, log.hitCount, log.maxScore, log.usedFallback));

    return paginate<RagQueryLog>(items, query);
  },

  async getRagQueryLogDetail(logId: number): Promise<AdminRagQueryLogDetail> {
    if (!env.USE_MOCK_DB) {
      const detail = await adminRepository.getRagQueryLogDetail(logId);
      if (!detail) throw new AppError("RAG_LOG_001", "RAG query log not found", 404);
      return detail;
    }

    const log = store.ragQueryLogs.find((item) => item.id === logId);
    if (!log) throw new AppError("RAG_LOG_001", "RAG query log not found", 404);

    const message =
      log.messageId === undefined
        ? undefined
        : store.messages.find((item) => item.id === log.messageId && item.userId === log.userId);
    const conversation =
      log.conversationId === undefined ? undefined : buildMockConversations().find((item) => item.id === log.conversationId);
    const feedback =
      log.messageId === undefined
        ? []
        : store.feedback
            .filter((item) => item.messageId === log.messageId && item.userId === log.userId)
            .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))
            .map<AdminFeedbackListItem>((item) => ({
              ...item,
              conversationId: message?.conversationId,
              messagePreview: preview(message?.content)
            }));

    return {
      log: toAdminRagQueryLogItem(log),
      message: message ? toAdminMessageListItem(message) : undefined,
      conversation,
      feedback
    };
  },

  async getFeedbackStats() {
    if (!env.USE_MOCK_DB) return adminRepository.getFeedbackStats();
    return {
      total: store.feedback.length,
      up: store.feedback.filter((item) => item.rating === "up").length,
      down: store.feedback.filter((item) => item.rating === "down").length
    };
  },

  async listFeedback(query: AdminFeedbackQuery) {
    if (!env.USE_MOCK_DB) return adminRepository.listFeedback(query);

    const items = applyBaseFilters(store.feedback, query)
      .filter((feedback) => query.rating === undefined || feedback.rating === query.rating)
      .filter((feedback) => query.reason === undefined || feedback.reason === query.reason)
      .filter((feedback) => query.messageId === undefined || feedback.messageId === query.messageId)
      .map<AdminFeedbackListItem>((feedback) => {
        const message = store.messages.find((item) => item.id === feedback.messageId && item.userId === feedback.userId);
        return {
          ...feedback,
          conversationId: message?.conversationId,
          messagePreview: preview(message?.content)
        };
      })
      .filter((feedback) =>
        matchesKeyword(
          query.keyword,
          feedback.id,
          feedback.messageId,
          feedback.rating,
          feedback.reason,
          feedback.comment,
          feedback.messagePreview
        )
      );

    return paginate<AdminFeedbackListItem>(items, query);
  },

  async getFeedbackDetail(feedbackId: number): Promise<AdminFeedbackDetail> {
    if (!env.USE_MOCK_DB) {
      const detail = await adminRepository.getFeedbackDetail(feedbackId);
      if (!detail) throw new AppError("FEEDBACK_001", "Feedback not found", 404);
      return detail;
    }

    const feedback = store.feedback.find((item) => item.id === feedbackId);
    if (!feedback) throw new AppError("FEEDBACK_001", "Feedback not found", 404);

    const message = store.messages.find((item) => item.id === feedback.messageId && item.userId === feedback.userId);
    const feedbackItem: AdminFeedbackListItem = {
      ...feedback,
      conversationId: message?.conversationId,
      messagePreview: preview(message?.content)
    };
    const conversation =
      message === undefined ? undefined : buildMockConversations().find((item) => item.id === message.conversationId);
    const ragLogs = store.ragQueryLogs
      .filter((log) => log.messageId === feedback.messageId && log.userId === feedback.userId)
      .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))
      .slice(0, 20)
      .map<AdminRagQueryLogItem>(toAdminRagQueryLogItem);
    const modelCalls =
      message === undefined
        ? []
        : store.modelCallLogs
            .filter((log) => log.conversationId === message.conversationId && log.userId === feedback.userId)
            .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))
            .slice(0, 20)
            .map<AdminModelCallLogItem>(toAdminModelCallLogItem);

    return {
      feedback: feedbackItem,
      message: message ? toAdminMessageListItem(message) : undefined,
      conversation,
      ragLogs,
      modelCalls
    };
  },

  async listMessages(query: AdminMessageQuery) {
    if (!env.USE_MOCK_DB) return adminRepository.listMessages(query);

    const items = applyBaseFilters(store.messages, query)
      .filter((message) => query.role === undefined || message.role === query.role)
      .filter((message) => query.conversationId === undefined || message.conversationId === query.conversationId)
      .filter((message) => matchesKeyword(query.keyword, message.id, message.conversationId, message.role, message.content))
      .map<AdminMessageListItem>(toAdminMessageListItem);

    return paginate<AdminMessageListItem>(items, query);
  },

  async getMessageDetail(messageId: number): Promise<AdminMessageDetail> {
    if (!env.USE_MOCK_DB) {
      const detail = await adminRepository.getMessageDetail(messageId);
      if (!detail) throw new AppError("MESSAGE_001", "Message not found", 404);
      return detail;
    }

    const message = store.messages.find((item) => item.id === messageId);
    if (!message) throw new AppError("MESSAGE_001", "Message not found", 404);

    const conversation = buildMockConversations().find((item) => item.id === message.conversationId);
    const ragLogs = store.ragQueryLogs
      .filter((log) => log.messageId === messageId && log.userId === message.userId)
      .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))
      .map<AdminRagQueryLogItem>(toAdminRagQueryLogItem);
    const feedback = store.feedback
      .filter((item) => item.messageId === messageId && item.userId === message.userId)
      .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))
      .map<AdminFeedbackListItem>((item) => ({
        ...item,
        conversationId: message.conversationId,
        messagePreview: preview(message.content)
      }));
    const modelCalls = store.modelCallLogs
      .filter((log) => log.conversationId === message.conversationId && log.userId === message.userId)
      .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))
      .slice(0, 20)
      .map<AdminModelCallLogItem>(toAdminModelCallLogItem);

    return {
      message: toAdminMessageListItem(message),
      conversation,
      ragLogs,
      feedback,
      modelCalls
    };
  },

  async listConversations(query: AdminConversationQuery) {
    if (!env.USE_MOCK_DB) return adminRepository.listConversations(query);

    const items = buildMockConversations()
      .filter((conversation) => query.userId === undefined || conversation.userId === query.userId)
      .filter((conversation) => query.status === undefined || conversation.status === query.status)
      .filter(
        (conversation) =>
          query.createdFrom === undefined || Date.parse(conversation.createdAt) >= Date.parse(query.createdFrom)
      )
      .filter((conversation) => query.createdTo === undefined || Date.parse(conversation.createdAt) <= Date.parse(query.createdTo))
      .filter((conversation) =>
        matchesKeyword(
          query.keyword,
          conversation.id,
          conversation.title,
          conversation.summary,
          conversation.status,
          conversation.lastMessagePreview
        )
      )
      .sort((left, right) => {
        const diff = Date.parse(left.updatedAt) - Date.parse(right.updatedAt);
        return query.sortOrder === "asc" ? diff : -diff;
      });

    return paginate<AdminConversationListItem>(items, query);
  },

  async getConversationDetail(conversationId: number): Promise<AdminConversationDetail> {
    if (!env.USE_MOCK_DB) {
      const detail = await adminRepository.getConversationDetail(conversationId);
      if (!detail) throw new AppError("CONVERSATION_001", "Conversation not found", 404);
      return detail;
    }

    const conversation = buildMockConversations().find((item) => item.id === conversationId);
    if (!conversation) throw new AppError("CONVERSATION_001", "Conversation not found", 404);

    const messages = store.messages
      .filter((message) => message.conversationId === conversationId && message.userId === conversation.userId)
      .sort((left, right) => Date.parse(left.createdAt) - Date.parse(right.createdAt))
      .slice(-50)
      .map<AdminMessageListItem>(toAdminMessageListItem);
    const conversationMessages = store.messages.filter(
      (message) => message.conversationId === conversationId && message.userId === conversation.userId
    );
    const summary = buildConversationActivitySummary(conversationMessages, conversation.userId, conversationId);

    return {
      conversation,
      messages,
      summary
    };
  },

  async listFiles(query: AdminFileQuery) {
    if (!env.USE_MOCK_DB) return adminRepository.listFiles(query);

    const items = applyBaseFilters(store.files, query)
      .filter((file) => query.fileType === undefined || file.fileType === query.fileType)
      .filter((file) => query.status === undefined || file.status === query.status)
      .filter((file) => query.ingestMode === undefined || file.ingestMode === query.ingestMode)
      .filter((file) =>
        matchesKeyword(query.keyword, file.id, file.fileName, file.fileType, file.status, file.checksum, file.ingestMode)
      )
      .map<AdminFileListItem>(toAdminFileListItem);

    return paginate<AdminFileListItem>(items, query);
  },

  async getFileDetail(fileId: number): Promise<AdminFileDetail> {
    if (!env.USE_MOCK_DB) {
      const detail = await adminRepository.getFileDetail(fileId);
      if (!detail) throw new AppError("FILE_001", "File not found", 404);
      return detail;
    }

    const file = store.files.find((item) => item.id === fileId);
    if (!file) throw new AppError("FILE_001", "File not found", 404);

    const ingestTasks = store.tasks
      .filter((task) => task.fileId === fileId)
      .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))
      .map(toAdminFileTaskItem);
    const fileTasks = store.tasks.filter((task) => task.fileId === fileId);

    return {
      file: toAdminFileListItem(file),
      ingestTasks,
      summary: buildFileActivitySummary(fileId, fileTasks)
    };
  },

  async listAuditLogs(query: AdminAuditLogQuery) {
    if (!env.USE_MOCK_DB) return adminRepository.listAuditLogs(query);

    const items = applyBaseFilters(store.auditLogs, query)
      .filter((log) => query.action === undefined || log.action === query.action)
      .filter((log) => query.riskLevel === undefined || log.riskLevel === query.riskLevel)
      .filter((log) => query.status === undefined || log.status === query.status)
      .filter((log) =>
        matchesKeyword(query.keyword, log.id, log.action, log.targetType, log.riskLevel, log.status, log.errorCode)
      )
      .map<AdminAuditLogItem>(toAdminAuditLogItem);

    return paginate<AdminAuditLogItem>(items, query);
  },

  async getAuditLogDetail(logId: number): Promise<AdminAuditLogDetail> {
    if (!env.USE_MOCK_DB) {
      const detail = await adminRepository.getAuditLogDetail(logId);
      if (!detail) throw new AppError("AUDIT_LOG_001", "Audit log not found", 404);
      return detail;
    }

    const log = store.auditLogs.find((item) => item.id === logId);
    if (!log) throw new AppError("AUDIT_LOG_001", "Audit log not found", 404);

    const targetMessage =
      log.targetType === "message" && log.targetId !== undefined
        ? store.messages.find((item) => item.id === log.targetId && item.userId === log.userId)
        : undefined;
    const targetFile =
      log.targetType === "file" && log.targetId !== undefined
        ? store.files.find((item) => item.id === log.targetId && item.userId === log.userId)
        : undefined;
    const targetUser =
      log.targetType === "user" && log.targetId !== undefined
        ? buildMockUserSummary(log.targetId)
        : undefined;

    return {
      log: toAdminAuditLogItem(log),
      user: log.userId !== undefined ? buildMockUserSummary(log.userId) : undefined,
      targetUser,
      targetMessage: targetMessage ? toAdminMessageListItem(targetMessage) : undefined,
      targetFile: targetFile ? toAdminFileListItem(targetFile) : undefined
    };
  }
};
