import { z } from "zod";

const optionalText = (max = 100) =>
  z.preprocess(
    (value) => (value === undefined || value === "" ? undefined : value),
    z.string().trim().min(1).max(max).optional()
  );

const optionalPositiveInt = z.preprocess(
  (value) => (value === undefined || value === "" ? undefined : value),
  z.coerce.number().int().positive().optional()
);

const optionalBoolean = z.preprocess((value) => {
  if (value === undefined || value === "") return undefined;
  if (value === "true") return true;
  if (value === "false") return false;
  return value;
}, z.boolean().optional());

const optionalDateTime = z.preprocess(
  (value) => (value === undefined || value === "" ? undefined : value),
  z.string().datetime({ offset: true }).optional()
);

export const adminBaseListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
  keyword: optionalText(),
  userId: optionalPositiveInt,
  createdFrom: optionalDateTime,
  createdTo: optionalDateTime
});

export const adminIdParamSchema = z.object({
  id: z.coerce.number().int().positive()
});

export const adminDashboardTrendQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(90).default(7)
});

export const adminDashboardBreakdownQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(90).default(7)
});

export const adminSecurityOverviewQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(90).default(7)
});

export const adminUserSecurityEventQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
  days: z.coerce.number().int().min(1).max(365).default(30),
  keyword: optionalText(100),
  action: optionalText(80),
  riskLevel: z.enum(["low", "medium", "high"]).optional(),
  status: z.enum(["success", "blocked", "failed"]).optional()
});

export const adminIngestTaskQuerySchema = adminBaseListQuerySchema.extend({
  status: z
    .enum(["pending", "parsing", "cleaning", "chunking", "embedding", "upserting", "processing", "completed", "failed"])
    .optional(),
  taskType: z.enum(["file", "image", "audio"]).optional(),
  fileId: optionalPositiveInt
});

export const adminModelCallLogQuerySchema = adminBaseListQuerySchema.extend({
  provider: optionalText(50),
  purpose: z.enum(["chat", "rewrite_query", "summarize", "embedding", "safety"]).optional(),
  status: z.enum(["success", "failed", "timeout", "aborted"]).optional()
});

export const adminRagQueryLogQuerySchema = adminBaseListQuerySchema.extend({
  usedFallback: optionalBoolean
});

export const adminFeedbackQuerySchema = adminBaseListQuerySchema.extend({
  rating: z.enum(["up", "down"]).optional(),
  reason: z.enum(["answer_irrelevant", "wrong_citation", "incomplete", "hallucination", "other"]).optional(),
  messageId: optionalPositiveInt
});

export const adminMessageQuerySchema = adminBaseListQuerySchema.extend({
  role: z.enum(["user", "assistant"]).optional(),
  conversationId: optionalPositiveInt
});

export const adminConversationQuerySchema = adminBaseListQuerySchema.extend({
  status: z.enum(["active", "archived", "deleted"]).optional()
});

export const adminFileQuerySchema = adminBaseListQuerySchema.extend({
  fileType: z.enum(["pdf", "word", "excel", "txt", "image", "audio"]).optional(),
  status: z.enum(["uploaded", "processing", "ready", "failed", "deleted"]).optional(),
  ingestMode: z.enum(["temporary", "permanent"]).optional()
});

export const adminAuditLogQuerySchema = adminBaseListQuerySchema.extend({
  action: optionalText(80),
  riskLevel: z.enum(["low", "medium", "high"]).optional(),
  status: z.enum(["success", "blocked", "failed"]).optional()
});

export const adminUserQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
  keyword: optionalText(100),
  role: z.enum(["user", "admin"]).optional(),
  status: z.enum(["active", "disabled"]).optional(),
  createdFrom: optionalDateTime,
  createdTo: optionalDateTime
});

export const adminUserStatusUpdateSchema = z.object({
  status: z.enum(["active", "disabled"])
});

export type AdminBaseListQuery = z.infer<typeof adminBaseListQuerySchema>;
export type AdminIdParam = z.infer<typeof adminIdParamSchema>;
export type AdminDashboardTrendQuery = z.infer<typeof adminDashboardTrendQuerySchema>;
export type AdminDashboardBreakdownQuery = z.infer<typeof adminDashboardBreakdownQuerySchema>;
export type AdminSecurityOverviewQuery = z.infer<typeof adminSecurityOverviewQuerySchema>;
export type AdminUserSecurityEventQuery = z.infer<typeof adminUserSecurityEventQuerySchema>;
export type AdminIngestTaskQuery = z.infer<typeof adminIngestTaskQuerySchema>;
export type AdminModelCallLogQuery = z.infer<typeof adminModelCallLogQuerySchema>;
export type AdminRagQueryLogQuery = z.infer<typeof adminRagQueryLogQuerySchema>;
export type AdminFeedbackQuery = z.infer<typeof adminFeedbackQuerySchema>;
export type AdminMessageQuery = z.infer<typeof adminMessageQuerySchema>;
export type AdminConversationQuery = z.infer<typeof adminConversationQuerySchema>;
export type AdminFileQuery = z.infer<typeof adminFileQuerySchema>;
export type AdminAuditLogQuery = z.infer<typeof adminAuditLogQuerySchema>;
export type AdminUserQuery = z.infer<typeof adminUserQuerySchema>;
export type AdminUserStatusUpdateRequest = z.infer<typeof adminUserStatusUpdateSchema>;

export type AdminFeedbackListItem = {
  id: number;
  userId: number;
  messageId: number;
  conversationId?: number;
  rating: "up" | "down";
  reason?: "answer_irrelevant" | "wrong_citation" | "incomplete" | "hallucination" | "other";
  comment?: string;
  messagePreview?: string;
  createdAt: string;
};

export type AdminFeedbackDetail = {
  feedback: AdminFeedbackListItem;
  message?: AdminMessageListItem;
  conversation?: AdminConversationListItem;
  ragLogs: AdminRagQueryLogItem[];
  modelCalls: AdminModelCallLogItem[];
};

export type AdminMessageListItem = {
  id: number;
  userId: number;
  conversationId: number;
  role: "user" | "assistant";
  contentPreview: string;
  createdAt: string;
};

export type AdminMessageDetail = {
  message: AdminMessageListItem;
  conversation?: AdminConversationListItem;
  ragLogs: AdminRagQueryLogItem[];
  feedback: AdminFeedbackListItem[];
  modelCalls: AdminModelCallLogItem[];
};

export type AdminConversationListItem = {
  id: number;
  userId: number;
  title?: string;
  summary?: string;
  status: "active" | "archived" | "deleted";
  messageCount: number;
  lastMessageAt?: string;
  lastMessagePreview?: string;
  createdAt: string;
  updatedAt: string;
};

export type AdminConversationDetail = {
  conversation: AdminConversationListItem;
  messages: AdminMessageListItem[];
  summary: AdminConversationActivitySummary;
};

export type AdminConversationActivitySummary = {
  userMessageCount: number;
  assistantMessageCount: number;
  ragQueryCount: number;
  fallbackCount: number;
  feedbackCount: number;
  downFeedbackCount: number;
  safetyBlockCount: number;
  modelCallCount: number;
  lastUserMessageAt?: string;
  lastAssistantMessageAt?: string;
  lastRagQueryAt?: string;
  lastFeedbackAt?: string;
  lastSafetyBlockAt?: string;
  lastModelCallAt?: string;
};

export type AdminFileListItem = {
  id: number;
  userId: number;
  fileName: string;
  fileSize: number;
  fileType: "pdf" | "word" | "excel" | "txt" | "image" | "audio";
  checksum: string;
  ingestMode: "temporary" | "permanent";
  status: "uploaded" | "processing" | "ready" | "failed" | "deleted";
  chunkCount?: number;
  createdAt: string;
  updatedAt?: string;
};

export type AdminFileIngestTaskItem = {
  id: number;
  userId: number;
  fileId: number;
  taskType: "file" | "image" | "audio";
  status: "pending" | "parsing" | "cleaning" | "chunking" | "embedding" | "upserting" | "processing" | "completed" | "failed";
  progress: number;
  errorCode?: string;
  errorMessage?: string;
  createdAt: string;
  finishedAt?: string;
};

export type AdminFileDetail = {
  file: AdminFileListItem;
  ingestTasks: AdminFileIngestTaskItem[];
  summary: AdminFileActivitySummary;
};

export type AdminFileActivitySummary = {
  taskCount: number;
  completedTaskCount: number;
  failedTaskCount: number;
  processingTaskCount: number;
  chunkCount: number;
  ingestTasksByStatus: Record<string, number>;
  latestTaskStatus?: AdminFileIngestTaskItem["status"];
  latestTaskProgress?: number;
  lastTaskAt?: string;
  lastCompletedAt?: string;
  lastFailedAt?: string;
};

export type AdminIngestTaskDetail = {
  task: AdminFileIngestTaskItem;
  file?: AdminFileListItem;
  relatedTasks: AdminFileIngestTaskItem[];
  summary: AdminFileActivitySummary;
};

export type AdminRagQueryLogItem = {
  id: number;
  userId: number;
  conversationId?: number;
  messageId?: number;
  query: string;
  rewrittenQuery?: string;
  topK?: number;
  thresholdValue?: number;
  hitCount: number;
  maxScore?: number;
  usedFallback: boolean;
  latencyMs: number;
  createdAt: string;
};

export type AdminRagQueryLogDetail = {
  log: AdminRagQueryLogItem;
  message?: AdminMessageListItem;
  conversation?: AdminConversationListItem;
  feedback: AdminFeedbackListItem[];
};

export type AdminModelCallLogItem = {
  id: number;
  userId: number;
  conversationId?: number;
  provider: string;
  purpose: "chat" | "rewrite_query" | "summarize" | "embedding" | "safety";
  status: "success" | "failed" | "timeout" | "aborted";
  latencyMs: number;
  tokenInput?: number;
  tokenOutput?: number;
  errorCode?: string;
  createdAt: string;
};

export type AdminModelCallLogDetail = {
  log: AdminModelCallLogItem;
  conversation?: AdminConversationListItem;
  messages: AdminMessageListItem[];
  ragLogs: AdminRagQueryLogItem[];
  feedback: AdminFeedbackListItem[];
};

export type AdminAuditLogItem = {
  id: number;
  userId?: number;
  action: string;
  targetType?: string;
  targetId?: number;
  riskLevel: "low" | "medium" | "high";
  status: "success" | "blocked" | "failed";
  errorCode?: string;
  ip?: string;
  userAgent?: string;
  createdAt: string;
};

export type AdminAuditLogDetail = {
  log: AdminAuditLogItem;
  user?: AdminUserSummary;
  targetUser?: AdminUserSummary;
  targetMessage?: AdminMessageListItem;
  targetFile?: AdminFileListItem;
};

export type AdminUserSummary = {
  id: number;
  username?: string;
  role?: "user" | "admin";
  status?: "active" | "disabled";
  createdAt?: string;
  updatedAt?: string;
};

export type AdminUserListItem = AdminUserSummary & {
  conversationCount: number;
  messageCount: number;
  fileCount: number;
  feedbackCount: number;
  lastActiveAt?: string;
};

export type AdminUserDetail = {
  user: AdminUserSummary;
};

export type AdminUserStatusUpdateResponse = {
  user: AdminUserSummary;
};

export type AdminUserActivityMetrics = {
  conversationCount: number;
  messageCount: number;
  fileCount: number;
  readyFileCount: number;
  feedbackCount: number;
  downFeedbackCount: number;
  auditLogCount: number;
  safetyBlockCount: number;
  ragQueryCount: number;
  modelCallCount: number;
};

export type AdminUserActivitySummary = {
  user: AdminUserSummary;
  metrics: AdminUserActivityMetrics;
  recentConversations: AdminConversationListItem[];
  recentFiles: AdminFileListItem[];
  recentFeedback: AdminFeedbackListItem[];
  recentAuditLogs: AdminAuditLogItem[];
};

export type AdminDashboardTrendPoint = {
  date: string;
  chatCount: number;
  modelCallCount: number;
  avgModelLatencyMs: number;
  ragQueryCount: number;
  fallbackCount: number;
  fallbackRate: number;
  safetyBlockCount: number;
  feedbackCount: number;
};

export type AdminDashboardTrends = {
  days: number;
  points: AdminDashboardTrendPoint[];
};

export type AdminDashboardBreakdowns = {
  days: number;
  filesByStatus: Record<string, number>;
  ingestTasksByStatus: Record<string, number>;
  modelCallsByStatus: Record<string, number>;
  modelCallsByPurpose: Record<string, number>;
  ragFallback: {
    fallback: number;
    nonFallback: number;
  };
  feedbackByRating: Record<string, number>;
  feedbackDownReasons: Record<string, number>;
  auditByRiskLevel: Record<string, number>;
  auditByStatus: Record<string, number>;
};

export type AdminAuditActionSummary = {
  action: string;
  count: number;
  failedCount: number;
  blockedCount: number;
  lastSeenAt?: string;
};

export type AdminSecurityOverview = {
  days: number;
  totalAuditCount: number;
  successCount: number;
  failedCount: number;
  blockedCount: number;
  highRiskCount: number;
  authFailureCount: number;
  permissionDeniedCount: number;
  safetyBlockCount: number;
  uniqueUserCount: number;
  auditByRiskLevel: Record<string, number>;
  auditByStatus: Record<string, number>;
  topActions: AdminAuditActionSummary[];
  recentHighRiskLogs: AdminAuditLogItem[];
};

export type AdminUserSecurityEventMetrics = {
  totalAuditCount: number;
  successCount: number;
  failedCount: number;
  blockedCount: number;
  highRiskCount: number;
  authFailureCount: number;
  permissionDeniedCount: number;
  safetyBlockCount: number;
  lastEventAt?: string;
};

export type AdminUserSecurityEvents = {
  user: AdminUserSummary;
  days: number;
  metrics: AdminUserSecurityEventMetrics;
  auditByRiskLevel: Record<string, number>;
  auditByStatus: Record<string, number>;
  events: PaginatedResult<AdminAuditLogItem>;
};

export type PaginatedResult<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};
