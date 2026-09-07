import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { mysqlPool } from "../providers/mysql.provider.js";
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
  AdminUserListItem,
  AdminUserQuery,
  AdminUserSecurityEventQuery,
  AdminUserSecurityEvents,
  AdminUserSummary,
  PaginatedResult
} from "../schemas/admin.schema.js";

type CountRow = RowDataPacket & { count: number };
type RateRow = RowDataPacket & { total: number; matched: number };
type DailyCountRow = RowDataPacket & { date: string; count: number };
type DailyModelCallRow = RowDataPacket & { date: string; count: number; avgLatencyMs: number | null };
type DailyRagRow = RowDataPacket & { date: string; count: number; fallbackCount: number };
type DistributionRow = RowDataPacket & { label: string | null; count: number };
type RagFallbackDistributionRow = RowDataPacket & { fallback: number | null; nonFallback: number | null };
type SecurityOverviewCountRow = RowDataPacket & {
  totalAuditCount: number;
  successCount: number | null;
  failedCount: number | null;
  blockedCount: number | null;
  highRiskCount: number | null;
  authFailureCount: number | null;
  permissionDeniedCount: number | null;
  safetyBlockCount: number | null;
  uniqueUserCount: number | null;
};
type SecurityActionSummaryRow = RowDataPacket & {
  action: string;
  count: number;
  failedCount: number | null;
  blockedCount: number | null;
  lastSeenAt: string | null;
};
type FeedbackStatsRow = RowDataPacket & {
  total: number;
  up: number;
  down: number;
};
type AdminFileRow = RowDataPacket & AdminFileListItem;
type AdminFileIngestTaskRow = RowDataPacket & AdminFileIngestTaskItem;
type FileActivityRow = RowDataPacket & {
  taskCount: number;
  completedTaskCount: number;
  failedTaskCount: number;
  processingTaskCount: number;
  lastTaskAt: string | null;
  lastCompletedAt: string | null;
  lastFailedAt: string | null;
};
type AdminRagQueryLogRow = RowDataPacket & AdminRagQueryLogItem;
type AdminModelCallLogRow = RowDataPacket & AdminModelCallLogItem;
type AdminAuditLogRow = RowDataPacket & AdminAuditLogItem;
type AdminFeedbackRow = RowDataPacket & AdminFeedbackListItem;
type AdminUserRow = RowDataPacket & AdminUserSummary;
type AdminUserListRow = RowDataPacket & AdminUserListItem;
type AdminMessageRow = RowDataPacket & {
  id: number;
  userId: number;
  conversationId: number;
  role: "user" | "assistant";
  contentPreview: string;
  createdAt: string;
};
type ConversationActivityRow = RowDataPacket & {
  userMessageCount: number;
  assistantMessageCount: number;
  ragQueryCount: number;
  fallbackCount: number;
  feedbackCount: number;
  downFeedbackCount: number;
  safetyBlockCount: number;
  modelCallCount: number;
  lastUserMessageAt: string | null;
  lastAssistantMessageAt: string | null;
  lastRagQueryAt: string | null;
  lastFeedbackAt: string | null;
  lastSafetyBlockAt: string | null;
  lastModelCallAt: string | null;
};

async function count(sql: string) {
  const [rows] = await mysqlPool.query<CountRow[]>(sql);
  return rows[0]?.count ?? 0;
}

async function countWithParams(sql: string, params: unknown[]) {
  const [rows] = await mysqlPool.query<CountRow[]>(sql, params);
  return Number(rows[0]?.count ?? 0);
}

function pagination(query: AdminBaseListQuery) {
  return {
    limit: query.pageSize,
    offset: (query.page - 1) * query.pageSize,
    orderDirection: query.sortOrder === "asc" ? "ASC" : "DESC"
  } as const;
}

function paginatedResult<T>(items: T[], total: number, query: AdminBaseListQuery): PaginatedResult<T> {
  return {
    items,
    total,
    page: query.page,
    pageSize: query.pageSize,
    totalPages: Math.max(1, Math.ceil(total / query.pageSize))
  };
}

function addBaseConditions(query: AdminBaseListQuery, conditions: string[], params: unknown[]) {
  if (query.userId !== undefined) {
    conditions.push("user_id = ?");
    params.push(query.userId);
  }

  if (query.createdFrom !== undefined) {
    conditions.push("created_at >= ?");
    params.push(query.createdFrom);
  }

  if (query.createdTo !== undefined) {
    conditions.push("created_at <= ?");
    params.push(query.createdTo);
  }
}

function buildWhere(conditions: string[]) {
  return conditions.length > 0 ? ` WHERE ${conditions.join(" AND ")}` : "";
}

function likePattern(keyword: string) {
  return `%${keyword}%`;
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

function startDateForRecentDays(days: number) {
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  start.setUTCDate(start.getUTCDate() - days + 1);
  return start.toISOString().slice(0, 10);
}

function toNumberMap<T extends { date: string }>(rows: T[], value: (row: T) => number) {
  return new Map(rows.map((row) => [row.date, value(row)]));
}

function toDistribution(rows: DistributionRow[]) {
  return rows.reduce<Record<string, number>>((acc, row) => {
    const key = row.label ?? "unknown";
    acc[key] = Number(row.count ?? 0);
    return acc;
  }, {});
}

export const adminRepository = {
  countTodayMessages() {
    return count(
      `SELECT COUNT(*) AS count
       FROM messages
       WHERE role = 'user' AND DATE(created_at) = CURRENT_DATE()`
    );
  },

  countTodayModelCalls() {
    return count(
      `SELECT COUNT(*) AS count
       FROM model_call_logs
       WHERE DATE(created_at) = CURRENT_DATE()`
    );
  },

  async getRagHitRate() {
    const [rows] = await mysqlPool.query<RateRow[]>(
      `SELECT COUNT(*) AS total, SUM(hit_count > 0) AS matched
       FROM rag_query_logs`
    );
    const row = rows[0];
    return row && row.total > 0 ? Number(row.matched) / Number(row.total) : 0;
  },

  async getFallbackRate() {
    const [rows] = await mysqlPool.query<RateRow[]>(
      `SELECT COUNT(*) AS total, SUM(used_fallback = TRUE) AS matched
       FROM rag_query_logs`
    );
    const row = rows[0];
    return row && row.total > 0 ? Number(row.matched) / Number(row.total) : 0;
  },

  async getIngestSuccessRate() {
    const [rows] = await mysqlPool.query<RateRow[]>(
      `SELECT COUNT(*) AS total, SUM(status = 'completed') AS matched
       FROM ingest_tasks`
    );
    const row = rows[0];
    return row && row.total > 0 ? Number(row.matched) / Number(row.total) : 0;
  },

  countTodaySafetyBlocks() {
    return count(
      `SELECT COUNT(*) AS count
       FROM audit_logs
       WHERE status = 'blocked' AND DATE(created_at) = CURRENT_DATE()`
    );
  },

  async listIngestTasks(query: AdminIngestTaskQuery) {
    const conditions: string[] = [];
    const params: unknown[] = [];
    addBaseConditions(query, conditions, params);

    if (query.status !== undefined) {
      conditions.push("status = ?");
      params.push(query.status);
    }

    if (query.taskType !== undefined) {
      conditions.push("task_type = ?");
      params.push(query.taskType);
    }

    if (query.fileId !== undefined) {
      conditions.push("file_id = ?");
      params.push(query.fileId);
    }

    if (query.keyword !== undefined) {
      const keyword = likePattern(query.keyword);
      conditions.push(
        "(CAST(id AS CHAR) LIKE ? OR CAST(file_id AS CHAR) LIKE ? OR task_type LIKE ? OR status LIKE ? OR error_code LIKE ? OR error_message LIKE ?)"
      );
      params.push(keyword, keyword, keyword, keyword, keyword, keyword);
    }

    const where = buildWhere(conditions);
    const { limit, offset, orderDirection } = pagination(query);
    const total = await countWithParams(`SELECT COUNT(*) AS count FROM ingest_tasks${where}`, params);
    const [rows] = await mysqlPool.query<RowDataPacket[]>(
      `SELECT id, file_id AS fileId, user_id AS userId, task_type AS taskType,
              status, progress, error_code AS errorCode, error_message AS errorMessage,
              created_at AS createdAt, finished_at AS finishedAt
       FROM ingest_tasks
       ${where}
       ORDER BY created_at ${orderDirection}
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );
    return paginatedResult(rows, total, query);
  },

  async getIngestTaskDetail(taskId: number): Promise<AdminIngestTaskDetail | null> {
    const [taskRows] = await mysqlPool.query<AdminFileIngestTaskRow[]>(
      `SELECT id, file_id AS fileId, user_id AS userId, task_type AS taskType,
              status, progress, error_code AS errorCode, error_message AS errorMessage,
              created_at AS createdAt, finished_at AS finishedAt
       FROM ingest_tasks
       WHERE id = ?
       LIMIT 1`,
      [taskId]
    );

    const task = taskRows[0];
    if (!task) return null;

    const [fileRows] = await mysqlPool.query<AdminFileRow[]>(
      `SELECT id, user_id AS userId, file_name AS fileName, file_size AS fileSize,
              file_type AS fileType, checksum, ingest_mode AS ingestMode, status,
              chunk_count AS chunkCount, created_at AS createdAt, updated_at AS updatedAt
       FROM knowledge_files
       WHERE id = ?
       LIMIT 1`,
      [task.fileId]
    );

    const [relatedTasks] = await mysqlPool.query<AdminFileIngestTaskRow[]>(
      `SELECT id, file_id AS fileId, user_id AS userId, task_type AS taskType,
              status, progress, error_code AS errorCode, error_message AS errorMessage,
              created_at AS createdAt, finished_at AS finishedAt
       FROM ingest_tasks
       WHERE file_id = ? AND user_id = ?
       ORDER BY created_at DESC
       LIMIT 20`,
      [task.fileId, task.userId]
    );

    const [[activityRows], [statusRows]] = await Promise.all([
      mysqlPool.query<FileActivityRow[]>(
        `SELECT COUNT(*) AS taskCount,
                SUM(status = 'completed') AS completedTaskCount,
                SUM(status = 'failed') AS failedTaskCount,
                SUM(status NOT IN ('completed', 'failed')) AS processingTaskCount,
                MAX(created_at) AS lastTaskAt,
                MAX(CASE WHEN status = 'completed' THEN created_at END) AS lastCompletedAt,
                MAX(CASE WHEN status = 'failed' THEN created_at END) AS lastFailedAt
         FROM ingest_tasks
         WHERE file_id = ? AND user_id = ?`,
        [task.fileId, task.userId]
      ),
      mysqlPool.query<DistributionRow[]>(
        `SELECT status AS label, COUNT(*) AS count
         FROM ingest_tasks
         WHERE file_id = ? AND user_id = ?
         GROUP BY status`,
        [task.fileId, task.userId]
      )
    ]);

    const file = fileRows[0];
    const activity = activityRows[0];
    const latestTask = relatedTasks[0];
    const summary: AdminFileActivitySummary = {
      taskCount: Number(activity?.taskCount ?? 0),
      completedTaskCount: Number(activity?.completedTaskCount ?? 0),
      failedTaskCount: Number(activity?.failedTaskCount ?? 0),
      processingTaskCount: Number(activity?.processingTaskCount ?? 0),
      chunkCount: Number(file?.chunkCount ?? 0),
      ingestTasksByStatus: toDistribution(statusRows),
      latestTaskStatus: latestTask?.status,
      latestTaskProgress: latestTask?.progress,
      lastTaskAt: activity?.lastTaskAt ?? undefined,
      lastCompletedAt: activity?.lastCompletedAt ?? undefined,
      lastFailedAt: activity?.lastFailedAt ?? undefined
    };

    return {
      task,
      file,
      relatedTasks,
      summary
    };
  },

  async listModelCallLogs(query: AdminModelCallLogQuery) {
    const conditions: string[] = [];
    const params: unknown[] = [];
    addBaseConditions(query, conditions, params);

    if (query.provider !== undefined) {
      conditions.push("provider = ?");
      params.push(query.provider);
    }

    if (query.purpose !== undefined) {
      conditions.push("purpose = ?");
      params.push(query.purpose);
    }

    if (query.status !== undefined) {
      conditions.push("status = ?");
      params.push(query.status);
    }

    if (query.keyword !== undefined) {
      const keyword = likePattern(query.keyword);
      conditions.push("(CAST(id AS CHAR) LIKE ? OR provider LIKE ? OR purpose LIKE ? OR status LIKE ? OR error_code LIKE ?)");
      params.push(keyword, keyword, keyword, keyword, keyword);
    }

    const where = buildWhere(conditions);
    const { limit, offset, orderDirection } = pagination(query);
    const total = await countWithParams(`SELECT COUNT(*) AS count FROM model_call_logs${where}`, params);
    const [rows] = await mysqlPool.query<RowDataPacket[]>(
      `SELECT id, user_id AS userId, conversation_id AS conversationId, provider,
              purpose, status, latency_ms AS latencyMs, token_input AS tokenInput,
              token_output AS tokenOutput, error_code AS errorCode, created_at AS createdAt
       FROM model_call_logs
       ${where}
       ORDER BY created_at ${orderDirection}
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );
    return paginatedResult(rows, total, query);
  },

  async getModelCallLogDetail(logId: number): Promise<AdminModelCallLogDetail | null> {
    const [logRows] = await mysqlPool.query<AdminModelCallLogRow[]>(
      `SELECT id, user_id AS userId, conversation_id AS conversationId, provider,
              purpose, status, latency_ms AS latencyMs, token_input AS tokenInput,
              token_output AS tokenOutput, error_code AS errorCode, created_at AS createdAt
       FROM model_call_logs
       WHERE id = ?
       LIMIT 1`,
      [logId]
    );

    const log = logRows[0];
    if (!log) return null;

    let conversation: AdminConversationListItem | undefined;
    if (log.conversationId !== undefined && log.conversationId !== null) {
      const [conversationRows] = await mysqlPool.query<(RowDataPacket & AdminConversationListItem)[]>(
        `SELECT c.id, c.user_id AS userId, c.title, c.summary, c.status,
                (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id) AS messageCount,
                (SELECT MAX(m.created_at) FROM messages m WHERE m.conversation_id = c.id) AS lastMessageAt,
                (SELECT LEFT(m.content, 180)
                 FROM messages m
                 WHERE m.conversation_id = c.id
                 ORDER BY m.created_at DESC, m.id DESC
                 LIMIT 1) AS lastMessagePreview,
                c.created_at AS createdAt, c.updated_at AS updatedAt
         FROM conversations c
         WHERE c.id = ? AND c.user_id = ?
         LIMIT 1`,
        [log.conversationId, log.userId]
      );
      conversation = conversationRows[0];
    }

    const [messages] =
      log.conversationId === undefined || log.conversationId === null
        ? [[] as AdminMessageRow[]]
        : await mysqlPool.query<AdminMessageRow[]>(
            `SELECT id, user_id AS userId, conversation_id AS conversationId,
                    role, LEFT(content, 180) AS contentPreview, created_at AS createdAt
             FROM messages
             WHERE conversation_id = ? AND user_id = ?
             ORDER BY created_at ASC, id ASC
             LIMIT 20`,
            [log.conversationId, log.userId]
          );

    const [ragLogs] =
      log.conversationId === undefined || log.conversationId === null
        ? [[] as AdminRagQueryLogRow[]]
        : await mysqlPool.query<AdminRagQueryLogRow[]>(
            `SELECT id, user_id AS userId, conversation_id AS conversationId, message_id AS messageId,
                    query, rewritten_query AS rewrittenQuery, top_k AS topK,
                    threshold_value AS thresholdValue, hit_count AS hitCount, max_score AS maxScore,
                    used_fallback AS usedFallback, latency_ms AS latencyMs, created_at AS createdAt
             FROM rag_query_logs
             WHERE conversation_id = ? AND user_id = ?
             ORDER BY created_at DESC
             LIMIT 20`,
            [log.conversationId, log.userId]
          );

    const [feedback] =
      log.conversationId === undefined || log.conversationId === null
        ? [[] as AdminFeedbackRow[]]
        : await mysqlPool.query<AdminFeedbackRow[]>(
            `SELECT f.id, f.user_id AS userId, f.message_id AS messageId,
                    m.conversation_id AS conversationId,
                    f.rating, f.reason, f.comment,
                    LEFT(m.content, 180) AS messagePreview,
                    f.created_at AS createdAt
             FROM feedback f
             INNER JOIN messages m ON m.id = f.message_id AND m.user_id = f.user_id
             WHERE m.conversation_id = ? AND f.user_id = ?
             ORDER BY f.created_at DESC
             LIMIT 20`,
            [log.conversationId, log.userId]
          );

    return {
      log,
      conversation,
      messages,
      ragLogs,
      feedback
    };
  },

  async listRagQueryLogs(query: AdminRagQueryLogQuery) {
    const conditions: string[] = [];
    const params: unknown[] = [];
    addBaseConditions(query, conditions, params);

    if (query.usedFallback !== undefined) {
      conditions.push("used_fallback = ?");
      params.push(query.usedFallback);
    }

    if (query.keyword !== undefined) {
      const keyword = likePattern(query.keyword);
      conditions.push("(CAST(id AS CHAR) LIKE ? OR query LIKE ? OR rewritten_query LIKE ?)");
      params.push(keyword, keyword, keyword);
    }

    const where = buildWhere(conditions);
    const { limit, offset, orderDirection } = pagination(query);
    const total = await countWithParams(`SELECT COUNT(*) AS count FROM rag_query_logs${where}`, params);
    const [rows] = await mysqlPool.query<RowDataPacket[]>(
      `SELECT id, user_id AS userId, conversation_id AS conversationId, message_id AS messageId,
              query, rewritten_query AS rewrittenQuery, top_k AS topK,
              threshold_value AS thresholdValue, hit_count AS hitCount, max_score AS maxScore,
              used_fallback AS usedFallback, latency_ms AS latencyMs, created_at AS createdAt
       FROM rag_query_logs
       ${where}
       ORDER BY created_at ${orderDirection}
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );
    return paginatedResult(rows, total, query);
  },

  async getRagQueryLogDetail(logId: number): Promise<AdminRagQueryLogDetail | null> {
    const [logRows] = await mysqlPool.query<AdminRagQueryLogRow[]>(
      `SELECT id, user_id AS userId, conversation_id AS conversationId, message_id AS messageId,
              query, rewritten_query AS rewrittenQuery, top_k AS topK,
              threshold_value AS thresholdValue, hit_count AS hitCount, max_score AS maxScore,
              used_fallback AS usedFallback, latency_ms AS latencyMs, created_at AS createdAt
       FROM rag_query_logs
       WHERE id = ?
       LIMIT 1`,
      [logId]
    );

    const log = logRows[0];
    if (!log) return null;

    let message: AdminMessageRow | undefined;
    if (log.messageId !== undefined && log.messageId !== null) {
      const [messageRows] = await mysqlPool.query<AdminMessageRow[]>(
        `SELECT id, user_id AS userId, conversation_id AS conversationId,
                role, LEFT(content, 180) AS contentPreview, created_at AS createdAt
         FROM messages
         WHERE id = ? AND user_id = ?
         LIMIT 1`,
        [log.messageId, log.userId]
      );
      message = messageRows[0];
    }

    let conversation: AdminConversationListItem | undefined;
    if (log.conversationId !== undefined && log.conversationId !== null) {
      const [conversationRows] = await mysqlPool.query<(RowDataPacket & AdminConversationListItem)[]>(
        `SELECT c.id, c.user_id AS userId, c.title, c.summary, c.status,
                (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id) AS messageCount,
                (SELECT MAX(m.created_at) FROM messages m WHERE m.conversation_id = c.id) AS lastMessageAt,
                (SELECT LEFT(m.content, 180)
                 FROM messages m
                 WHERE m.conversation_id = c.id
                 ORDER BY m.created_at DESC, m.id DESC
                 LIMIT 1) AS lastMessagePreview,
                c.created_at AS createdAt, c.updated_at AS updatedAt
         FROM conversations c
         WHERE c.id = ? AND c.user_id = ?
         LIMIT 1`,
        [log.conversationId, log.userId]
      );
      conversation = conversationRows[0];
    }

    const [feedback] =
      log.messageId === undefined || log.messageId === null
        ? [[] as AdminFeedbackRow[]]
        : await mysqlPool.query<AdminFeedbackRow[]>(
            `SELECT f.id, f.user_id AS userId, f.message_id AS messageId,
                    m.conversation_id AS conversationId,
                    f.rating, f.reason, f.comment,
                    LEFT(m.content, 180) AS messagePreview,
                    f.created_at AS createdAt
             FROM feedback f
             LEFT JOIN messages m ON m.id = f.message_id
             WHERE f.message_id = ? AND f.user_id = ?
             ORDER BY f.created_at DESC
             LIMIT 20`,
            [log.messageId, log.userId]
          );

    return {
      log,
      message,
      conversation,
      feedback
    };
  },

  async getFeedbackStats() {
    const [rows] = await mysqlPool.query<FeedbackStatsRow[]>(
      `SELECT COUNT(*) AS total,
              SUM(rating = 'up') AS up,
              SUM(rating = 'down') AS down
       FROM feedback`
    );
    const row = rows[0];
    return {
      total: Number(row?.total ?? 0),
      up: Number(row?.up ?? 0),
      down: Number(row?.down ?? 0)
    };
  },

  async getDashboardTrends(query: AdminDashboardTrendQuery): Promise<AdminDashboardTrends> {
    const startDate = startDateForRecentDays(query.days);
    const [chatRows, modelRows, ragRows, safetyRows, feedbackRows] = await Promise.all([
      mysqlPool.query<DailyCountRow[]>(
        `SELECT DATE_FORMAT(created_at, '%Y-%m-%d') AS date, COUNT(*) AS count
         FROM messages
         WHERE role = 'user' AND DATE(created_at) >= ?
         GROUP BY DATE(created_at)`,
        [startDate]
      ),
      mysqlPool.query<DailyModelCallRow[]>(
        `SELECT DATE_FORMAT(created_at, '%Y-%m-%d') AS date, COUNT(*) AS count, AVG(latency_ms) AS avgLatencyMs
         FROM model_call_logs
         WHERE DATE(created_at) >= ?
         GROUP BY DATE(created_at)`,
        [startDate]
      ),
      mysqlPool.query<DailyRagRow[]>(
        `SELECT DATE_FORMAT(created_at, '%Y-%m-%d') AS date, COUNT(*) AS count, SUM(used_fallback = TRUE) AS fallbackCount
         FROM rag_query_logs
         WHERE DATE(created_at) >= ?
         GROUP BY DATE(created_at)`,
        [startDate]
      ),
      mysqlPool.query<DailyCountRow[]>(
        `SELECT DATE_FORMAT(created_at, '%Y-%m-%d') AS date, COUNT(*) AS count
         FROM audit_logs
         WHERE status = 'blocked' AND DATE(created_at) >= ?
         GROUP BY DATE(created_at)`,
        [startDate]
      ),
      mysqlPool.query<DailyCountRow[]>(
        `SELECT DATE_FORMAT(created_at, '%Y-%m-%d') AS date, COUNT(*) AS count
         FROM feedback
         WHERE DATE(created_at) >= ?
         GROUP BY DATE(created_at)`,
        [startDate]
      )
    ]);

    const chatMap = toNumberMap(chatRows[0], (row) => Number(row.count ?? 0));
    const modelCountMap = toNumberMap(modelRows[0], (row) => Number(row.count ?? 0));
    const modelLatencyMap = toNumberMap(modelRows[0], (row) => Math.round(Number(row.avgLatencyMs ?? 0)));
    const ragCountMap = toNumberMap(ragRows[0], (row) => Number(row.count ?? 0));
    const fallbackCountMap = toNumberMap(ragRows[0], (row) => Number(row.fallbackCount ?? 0));
    const safetyMap = toNumberMap(safetyRows[0], (row) => Number(row.count ?? 0));
    const feedbackMap = toNumberMap(feedbackRows[0], (row) => Number(row.count ?? 0));

    return {
      days: query.days,
      points: recentDateKeys(query.days).map((date) => {
        const ragQueryCount = ragCountMap.get(date) ?? 0;
        const fallbackCount = fallbackCountMap.get(date) ?? 0;
        return {
          date,
          chatCount: chatMap.get(date) ?? 0,
          modelCallCount: modelCountMap.get(date) ?? 0,
          avgModelLatencyMs: modelLatencyMap.get(date) ?? 0,
          ragQueryCount,
          fallbackCount,
          fallbackRate: ragQueryCount === 0 ? 0 : fallbackCount / ragQueryCount,
          safetyBlockCount: safetyMap.get(date) ?? 0,
          feedbackCount: feedbackMap.get(date) ?? 0
        };
      })
    };
  },

  async getDashboardBreakdowns(query: AdminDashboardBreakdownQuery): Promise<AdminDashboardBreakdowns> {
    const startDate = startDateForRecentDays(query.days);
    const [
      filesByStatusRows,
      ingestTasksByStatusRows,
      modelCallsByStatusRows,
      modelCallsByPurposeRows,
      ragFallbackRows,
      feedbackByRatingRows,
      feedbackDownReasonRows,
      auditByRiskLevelRows,
      auditByStatusRows
    ] = await Promise.all([
      mysqlPool.query<DistributionRow[]>(
        `SELECT status AS label, COUNT(*) AS count
         FROM knowledge_files
         WHERE DATE(created_at) >= ?
         GROUP BY status`,
        [startDate]
      ),
      mysqlPool.query<DistributionRow[]>(
        `SELECT status AS label, COUNT(*) AS count
         FROM ingest_tasks
         WHERE DATE(created_at) >= ?
         GROUP BY status`,
        [startDate]
      ),
      mysqlPool.query<DistributionRow[]>(
        `SELECT status AS label, COUNT(*) AS count
         FROM model_call_logs
         WHERE DATE(created_at) >= ?
         GROUP BY status`,
        [startDate]
      ),
      mysqlPool.query<DistributionRow[]>(
        `SELECT purpose AS label, COUNT(*) AS count
         FROM model_call_logs
         WHERE DATE(created_at) >= ?
         GROUP BY purpose`,
        [startDate]
      ),
      mysqlPool.query<RagFallbackDistributionRow[]>(
        `SELECT SUM(used_fallback = TRUE) AS fallback,
                SUM(used_fallback = FALSE) AS nonFallback
         FROM rag_query_logs
         WHERE DATE(created_at) >= ?`,
        [startDate]
      ),
      mysqlPool.query<DistributionRow[]>(
        `SELECT rating AS label, COUNT(*) AS count
         FROM feedback
         WHERE DATE(created_at) >= ?
         GROUP BY rating`,
        [startDate]
      ),
      mysqlPool.query<DistributionRow[]>(
        `SELECT reason AS label, COUNT(*) AS count
         FROM feedback
         WHERE rating = 'down' AND DATE(created_at) >= ?
         GROUP BY reason`,
        [startDate]
      ),
      mysqlPool.query<DistributionRow[]>(
        `SELECT risk_level AS label, COUNT(*) AS count
         FROM audit_logs
         WHERE DATE(created_at) >= ?
         GROUP BY risk_level`,
        [startDate]
      ),
      mysqlPool.query<DistributionRow[]>(
        `SELECT status AS label, COUNT(*) AS count
         FROM audit_logs
         WHERE DATE(created_at) >= ?
         GROUP BY status`,
        [startDate]
      )
    ]);

    const ragFallbackRow = ragFallbackRows[0][0];

    return {
      days: query.days,
      filesByStatus: toDistribution(filesByStatusRows[0]),
      ingestTasksByStatus: toDistribution(ingestTasksByStatusRows[0]),
      modelCallsByStatus: toDistribution(modelCallsByStatusRows[0]),
      modelCallsByPurpose: toDistribution(modelCallsByPurposeRows[0]),
      ragFallback: {
        fallback: Number(ragFallbackRow?.fallback ?? 0),
        nonFallback: Number(ragFallbackRow?.nonFallback ?? 0)
      },
      feedbackByRating: toDistribution(feedbackByRatingRows[0]),
      feedbackDownReasons: toDistribution(feedbackDownReasonRows[0]),
      auditByRiskLevel: toDistribution(auditByRiskLevelRows[0]),
      auditByStatus: toDistribution(auditByStatusRows[0])
    };
  },

  async getSecurityOverview(query: AdminSecurityOverviewQuery): Promise<AdminSecurityOverview> {
    const startDate = startDateForRecentDays(query.days);
    const [countRows, riskRows, statusRows, actionRows, highRiskRows] = await Promise.all([
      mysqlPool.query<SecurityOverviewCountRow[]>(
        `SELECT COUNT(*) AS totalAuditCount,
                SUM(status = 'success') AS successCount,
                SUM(status = 'failed') AS failedCount,
                SUM(status = 'blocked') AS blockedCount,
                SUM(risk_level = 'high') AS highRiskCount,
                SUM(action IN ('auth_login', 'auth_required', 'auth_authorization_header', 'auth_token_verify') AND status <> 'success') AS authFailureCount,
                SUM(action = 'rbac_permission_denied') AS permissionDeniedCount,
                SUM(status = 'blocked' OR error_code = 'SAFETY_BLOCKED') AS safetyBlockCount,
                COUNT(DISTINCT user_id) AS uniqueUserCount
         FROM audit_logs
         WHERE DATE(created_at) >= ?`,
        [startDate]
      ),
      mysqlPool.query<DistributionRow[]>(
        `SELECT risk_level AS label, COUNT(*) AS count
         FROM audit_logs
         WHERE DATE(created_at) >= ?
         GROUP BY risk_level`,
        [startDate]
      ),
      mysqlPool.query<DistributionRow[]>(
        `SELECT status AS label, COUNT(*) AS count
         FROM audit_logs
         WHERE DATE(created_at) >= ?
         GROUP BY status`,
        [startDate]
      ),
      mysqlPool.query<SecurityActionSummaryRow[]>(
        `SELECT action,
                COUNT(*) AS count,
                SUM(status = 'failed') AS failedCount,
                SUM(status = 'blocked') AS blockedCount,
                MAX(created_at) AS lastSeenAt
         FROM audit_logs
         WHERE DATE(created_at) >= ?
         GROUP BY action
         ORDER BY count DESC, lastSeenAt DESC
         LIMIT 10`,
        [startDate]
      ),
      mysqlPool.query<AdminAuditLogRow[]>(
        `SELECT id, user_id AS userId, action, target_type AS targetType,
                target_id AS targetId, risk_level AS riskLevel, status,
                error_code AS errorCode, ip, user_agent AS userAgent, created_at AS createdAt
         FROM audit_logs
         WHERE DATE(created_at) >= ? AND (risk_level = 'high' OR status = 'blocked')
         ORDER BY created_at DESC
         LIMIT 10`,
        [startDate]
      )
    ]);

    const counts = countRows[0][0];

    return {
      days: query.days,
      totalAuditCount: Number(counts?.totalAuditCount ?? 0),
      successCount: Number(counts?.successCount ?? 0),
      failedCount: Number(counts?.failedCount ?? 0),
      blockedCount: Number(counts?.blockedCount ?? 0),
      highRiskCount: Number(counts?.highRiskCount ?? 0),
      authFailureCount: Number(counts?.authFailureCount ?? 0),
      permissionDeniedCount: Number(counts?.permissionDeniedCount ?? 0),
      safetyBlockCount: Number(counts?.safetyBlockCount ?? 0),
      uniqueUserCount: Number(counts?.uniqueUserCount ?? 0),
      auditByRiskLevel: toDistribution(riskRows[0]),
      auditByStatus: toDistribution(statusRows[0]),
      topActions: actionRows[0].map((row) => ({
        action: row.action,
        count: Number(row.count ?? 0),
        failedCount: Number(row.failedCount ?? 0),
        blockedCount: Number(row.blockedCount ?? 0),
        lastSeenAt: row.lastSeenAt ?? undefined
      })),
      recentHighRiskLogs: highRiskRows[0]
    };
  },

  async listUsers(query: AdminUserQuery): Promise<PaginatedResult<AdminUserListItem>> {
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (query.role !== undefined) {
      conditions.push("u.role = ?");
      params.push(query.role);
    }

    if (query.status !== undefined) {
      conditions.push("u.status = ?");
      params.push(query.status);
    }

    if (query.createdFrom !== undefined) {
      conditions.push("u.created_at >= ?");
      params.push(query.createdFrom);
    }

    if (query.createdTo !== undefined) {
      conditions.push("u.created_at <= ?");
      params.push(query.createdTo);
    }

    if (query.keyword !== undefined) {
      const keyword = likePattern(query.keyword);
      conditions.push("(CAST(u.id AS CHAR) LIKE ? OR u.username LIKE ? OR u.role LIKE ? OR u.status LIKE ?)");
      params.push(keyword, keyword, keyword, keyword);
    }

    const where = buildWhere(conditions);
    const { limit, offset, orderDirection } = pagination(query);
    const total = await countWithParams(`SELECT COUNT(*) AS count FROM users u${where}`, params);
    const [rows] = await mysqlPool.query<AdminUserListRow[]>(
      `SELECT u.id, u.username, u.role, u.status,
              u.created_at AS createdAt, u.updated_at AS updatedAt,
              (SELECT COUNT(*) FROM conversations c WHERE c.user_id = u.id) AS conversationCount,
              (SELECT COUNT(*) FROM messages m WHERE m.user_id = u.id) AS messageCount,
              (SELECT COUNT(*) FROM knowledge_files kf WHERE kf.user_id = u.id) AS fileCount,
              (SELECT COUNT(*) FROM feedback f WHERE f.user_id = u.id) AS feedbackCount,
              GREATEST(
                u.updated_at,
                COALESCE((SELECT MAX(c.updated_at) FROM conversations c WHERE c.user_id = u.id), u.updated_at),
                COALESCE((SELECT MAX(m.created_at) FROM messages m WHERE m.user_id = u.id), u.updated_at),
                COALESCE((SELECT MAX(kf.updated_at) FROM knowledge_files kf WHERE kf.user_id = u.id), u.updated_at),
                COALESCE((SELECT MAX(f.created_at) FROM feedback f WHERE f.user_id = u.id), u.updated_at),
                COALESCE((SELECT MAX(a.created_at) FROM audit_logs a WHERE a.user_id = u.id), u.updated_at)
              ) AS lastActiveAt
       FROM users u
       ${where}
       ORDER BY u.created_at ${orderDirection}
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    return paginatedResult(rows, total, query);
  },

  async getUserDetail(userId: number): Promise<AdminUserSummary | null> {
    const [rows] = await mysqlPool.query<AdminUserRow[]>(
      `SELECT id, username, role, status, created_at AS createdAt, updated_at AS updatedAt
       FROM users
       WHERE id = ?
       LIMIT 1`,
      [userId]
    );

    return rows[0] ?? null;
  },

  async updateUserStatus(userId: number, status: AdminUserSummary["status"]): Promise<AdminUserSummary | null> {
    const [result] = await mysqlPool.query<ResultSetHeader>(
      `UPDATE users
       SET status = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [status, userId]
    );

    if (result.affectedRows === 0) return null;
    return adminRepository.getUserDetail(userId);
  },

  async getUserActivitySummary(userId: number): Promise<AdminUserActivitySummary | null> {
    const [userRows] = await mysqlPool.query<AdminUserRow[]>(
      `SELECT id, username, role, status, created_at AS createdAt, updated_at AS updatedAt
       FROM users
       WHERE id = ?
       LIMIT 1`,
      [userId]
    );

    const user = userRows[0];
    if (!user) return null;

    const [
      conversationCount,
      messageCount,
      fileCount,
      readyFileCount,
      feedbackCount,
      downFeedbackCount,
      auditLogCount,
      safetyBlockCount,
      ragQueryCount,
      modelCallCount
    ] = await Promise.all([
      countWithParams("SELECT COUNT(*) AS count FROM conversations WHERE user_id = ?", [userId]),
      countWithParams("SELECT COUNT(*) AS count FROM messages WHERE user_id = ?", [userId]),
      countWithParams("SELECT COUNT(*) AS count FROM knowledge_files WHERE user_id = ?", [userId]),
      countWithParams("SELECT COUNT(*) AS count FROM knowledge_files WHERE user_id = ? AND status = 'ready'", [userId]),
      countWithParams("SELECT COUNT(*) AS count FROM feedback WHERE user_id = ?", [userId]),
      countWithParams("SELECT COUNT(*) AS count FROM feedback WHERE user_id = ? AND rating = 'down'", [userId]),
      countWithParams("SELECT COUNT(*) AS count FROM audit_logs WHERE user_id = ?", [userId]),
      countWithParams("SELECT COUNT(*) AS count FROM audit_logs WHERE user_id = ? AND status = 'blocked'", [userId]),
      countWithParams("SELECT COUNT(*) AS count FROM rag_query_logs WHERE user_id = ?", [userId]),
      countWithParams("SELECT COUNT(*) AS count FROM model_call_logs WHERE user_id = ?", [userId])
    ]);

    const [recentConversations] = await mysqlPool.query<(RowDataPacket & AdminConversationListItem)[]>(
      `SELECT c.id, c.user_id AS userId, c.title, c.summary, c.status,
              (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id) AS messageCount,
              (SELECT MAX(m.created_at) FROM messages m WHERE m.conversation_id = c.id) AS lastMessageAt,
              (SELECT LEFT(m.content, 180)
               FROM messages m
               WHERE m.conversation_id = c.id
               ORDER BY m.created_at DESC, m.id DESC
               LIMIT 1) AS lastMessagePreview,
              c.created_at AS createdAt, c.updated_at AS updatedAt
       FROM conversations c
       WHERE c.user_id = ?
       ORDER BY c.updated_at DESC
       LIMIT 5`,
      [userId]
    );

    const [recentFiles] = await mysqlPool.query<AdminFileRow[]>(
      `SELECT id, user_id AS userId, file_name AS fileName, file_size AS fileSize,
              file_type AS fileType, checksum, ingest_mode AS ingestMode, status,
              chunk_count AS chunkCount, created_at AS createdAt, updated_at AS updatedAt
       FROM knowledge_files
       WHERE user_id = ?
       ORDER BY created_at DESC
       LIMIT 5`,
      [userId]
    );

    const [recentFeedback] = await mysqlPool.query<AdminFeedbackRow[]>(
      `SELECT f.id, f.user_id AS userId, f.message_id AS messageId,
              m.conversation_id AS conversationId,
              f.rating, f.reason, f.comment,
              LEFT(m.content, 180) AS messagePreview,
              f.created_at AS createdAt
       FROM feedback f
       LEFT JOIN messages m ON m.id = f.message_id
       WHERE f.user_id = ?
       ORDER BY f.created_at DESC
       LIMIT 5`,
      [userId]
    );

    const [recentAuditLogs] = await mysqlPool.query<AdminAuditLogRow[]>(
      `SELECT id, user_id AS userId, action, target_type AS targetType,
              target_id AS targetId, risk_level AS riskLevel, status,
              error_code AS errorCode, ip, user_agent AS userAgent, created_at AS createdAt
       FROM audit_logs
       WHERE user_id = ?
       ORDER BY created_at DESC
       LIMIT 5`,
      [userId]
    );

    return {
      user,
      metrics: {
        conversationCount,
        messageCount,
        fileCount,
        readyFileCount,
        feedbackCount,
        downFeedbackCount,
        auditLogCount,
        safetyBlockCount,
        ragQueryCount,
        modelCallCount
      },
      recentConversations,
      recentFiles,
      recentFeedback,
      recentAuditLogs
    };
  },

  async getUserSecurityEvents(userId: number, query: AdminUserSecurityEventQuery): Promise<AdminUserSecurityEvents | null> {
    const [userRows] = await mysqlPool.query<AdminUserRow[]>(
      `SELECT id, username, role, status, created_at AS createdAt, updated_at AS updatedAt
       FROM users
       WHERE id = ?
       LIMIT 1`,
      [userId]
    );
    const user = userRows[0];
    if (!user) return null;

    const startDate = startDateForRecentDays(query.days);
    const baseConditions = ["user_id = ?", "DATE(created_at) >= ?"];
    const baseParams: unknown[] = [userId, startDate];
    const filteredConditions = [...baseConditions];
    const filteredParams = [...baseParams];

    if (query.action !== undefined) {
      filteredConditions.push("action = ?");
      filteredParams.push(query.action);
    }

    if (query.riskLevel !== undefined) {
      filteredConditions.push("risk_level = ?");
      filteredParams.push(query.riskLevel);
    }

    if (query.status !== undefined) {
      filteredConditions.push("status = ?");
      filteredParams.push(query.status);
    }

    if (query.keyword !== undefined) {
      const keyword = likePattern(query.keyword);
      filteredConditions.push(
        "(CAST(id AS CHAR) LIKE ? OR action LIKE ? OR target_type LIKE ? OR risk_level LIKE ? OR status LIKE ? OR error_code LIKE ?)"
      );
      filteredParams.push(keyword, keyword, keyword, keyword, keyword, keyword);
    }

    const baseWhere = buildWhere(baseConditions);
    const filteredWhere = buildWhere(filteredConditions);
    const { limit, offset, orderDirection } = pagination(query);
    const [countRows, riskRows, statusRows, totalRows, eventRows, lastRows] = await Promise.all([
      mysqlPool.query<SecurityOverviewCountRow[]>(
        `SELECT COUNT(*) AS totalAuditCount,
                SUM(status = 'success') AS successCount,
                SUM(status = 'failed') AS failedCount,
                SUM(status = 'blocked') AS blockedCount,
                SUM(risk_level = 'high') AS highRiskCount,
                SUM(action IN ('auth_login', 'auth_required', 'auth_authorization_header', 'auth_token_verify') AND status <> 'success') AS authFailureCount,
                SUM(action = 'rbac_permission_denied') AS permissionDeniedCount,
                SUM(status = 'blocked' OR error_code = 'SAFETY_BLOCKED') AS safetyBlockCount,
                COUNT(DISTINCT user_id) AS uniqueUserCount
         FROM audit_logs
         ${baseWhere}`,
        baseParams
      ),
      mysqlPool.query<DistributionRow[]>(
        `SELECT risk_level AS label, COUNT(*) AS count
         FROM audit_logs
         ${baseWhere}
         GROUP BY risk_level`,
        baseParams
      ),
      mysqlPool.query<DistributionRow[]>(
        `SELECT status AS label, COUNT(*) AS count
         FROM audit_logs
         ${baseWhere}
         GROUP BY status`,
        baseParams
      ),
      mysqlPool.query<CountRow[]>(`SELECT COUNT(*) AS count FROM audit_logs ${filteredWhere}`, filteredParams),
      mysqlPool.query<AdminAuditLogRow[]>(
        `SELECT id, user_id AS userId, action, target_type AS targetType,
                target_id AS targetId, risk_level AS riskLevel, status,
                error_code AS errorCode, ip, user_agent AS userAgent, created_at AS createdAt
         FROM audit_logs
         ${filteredWhere}
         ORDER BY created_at ${orderDirection}
         LIMIT ? OFFSET ?`,
        [...filteredParams, limit, offset]
      ),
      mysqlPool.query<(RowDataPacket & { lastEventAt: string | null })[]>(
        `SELECT MAX(created_at) AS lastEventAt
         FROM audit_logs
         ${baseWhere}`,
        baseParams
      )
    ]);

    const counts = countRows[0][0];
    const total = Number(totalRows[0][0]?.count ?? 0);

    return {
      user,
      days: query.days,
      metrics: {
        totalAuditCount: Number(counts?.totalAuditCount ?? 0),
        successCount: Number(counts?.successCount ?? 0),
        failedCount: Number(counts?.failedCount ?? 0),
        blockedCount: Number(counts?.blockedCount ?? 0),
        highRiskCount: Number(counts?.highRiskCount ?? 0),
        authFailureCount: Number(counts?.authFailureCount ?? 0),
        permissionDeniedCount: Number(counts?.permissionDeniedCount ?? 0),
        safetyBlockCount: Number(counts?.safetyBlockCount ?? 0),
        lastEventAt: lastRows[0][0]?.lastEventAt ?? undefined
      },
      auditByRiskLevel: toDistribution(riskRows[0]),
      auditByStatus: toDistribution(statusRows[0]),
      events: paginatedResult(eventRows[0], total, query)
    };
  },

  async listFeedback(query: AdminFeedbackQuery) {
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (query.userId !== undefined) {
      conditions.push("f.user_id = ?");
      params.push(query.userId);
    }

    if (query.createdFrom !== undefined) {
      conditions.push("f.created_at >= ?");
      params.push(query.createdFrom);
    }

    if (query.createdTo !== undefined) {
      conditions.push("f.created_at <= ?");
      params.push(query.createdTo);
    }

    if (query.rating !== undefined) {
      conditions.push("f.rating = ?");
      params.push(query.rating);
    }

    if (query.reason !== undefined) {
      conditions.push("f.reason = ?");
      params.push(query.reason);
    }

    if (query.messageId !== undefined) {
      conditions.push("f.message_id = ?");
      params.push(query.messageId);
    }

    if (query.keyword !== undefined) {
      const keyword = likePattern(query.keyword);
      conditions.push(
        "(CAST(f.id AS CHAR) LIKE ? OR CAST(f.message_id AS CHAR) LIKE ? OR f.rating LIKE ? OR f.reason LIKE ? OR f.comment LIKE ? OR m.content LIKE ?)"
      );
      params.push(keyword, keyword, keyword, keyword, keyword, keyword);
    }

    const where = buildWhere(conditions);
    const { limit, offset, orderDirection } = pagination(query);
    const from = "FROM feedback f LEFT JOIN messages m ON m.id = f.message_id";
    const total = await countWithParams(`SELECT COUNT(*) AS count ${from}${where}`, params);
    const [rows] = await mysqlPool.query<RowDataPacket[]>(
      `SELECT f.id, f.user_id AS userId, f.message_id AS messageId,
              m.conversation_id AS conversationId,
              f.rating, f.reason, f.comment,
              LEFT(m.content, 180) AS messagePreview,
              f.created_at AS createdAt
       ${from}
       ${where}
       ORDER BY f.created_at ${orderDirection}
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    return paginatedResult(rows, total, query);
  },

  async getFeedbackDetail(feedbackId: number): Promise<AdminFeedbackDetail | null> {
    const [feedbackRows] = await mysqlPool.query<AdminFeedbackRow[]>(
      `SELECT f.id, f.user_id AS userId, f.message_id AS messageId,
              m.conversation_id AS conversationId,
              f.rating, f.reason, f.comment,
              LEFT(m.content, 180) AS messagePreview,
              f.created_at AS createdAt
       FROM feedback f
       LEFT JOIN messages m ON m.id = f.message_id
       WHERE f.id = ?
       LIMIT 1`,
      [feedbackId]
    );

    const feedback = feedbackRows[0];
    if (!feedback) return null;

    let message: AdminMessageRow | undefined;
    if (feedback.messageId !== undefined && feedback.messageId !== null) {
      const [messageRows] = await mysqlPool.query<AdminMessageRow[]>(
        `SELECT id, user_id AS userId, conversation_id AS conversationId,
                role, LEFT(content, 180) AS contentPreview, created_at AS createdAt
         FROM messages
         WHERE id = ? AND user_id = ?
         LIMIT 1`,
        [feedback.messageId, feedback.userId]
      );
      message = messageRows[0];
    }

    let conversation: AdminConversationListItem | undefined;
    if (feedback.conversationId !== undefined && feedback.conversationId !== null) {
      const [conversationRows] = await mysqlPool.query<(RowDataPacket & AdminConversationListItem)[]>(
        `SELECT c.id, c.user_id AS userId, c.title, c.summary, c.status,
                (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id) AS messageCount,
                (SELECT MAX(m.created_at) FROM messages m WHERE m.conversation_id = c.id) AS lastMessageAt,
                (SELECT LEFT(m.content, 180)
                 FROM messages m
                 WHERE m.conversation_id = c.id
                 ORDER BY m.created_at DESC, m.id DESC
                 LIMIT 1) AS lastMessagePreview,
                c.created_at AS createdAt, c.updated_at AS updatedAt
         FROM conversations c
         WHERE c.id = ? AND c.user_id = ?
         LIMIT 1`,
        [feedback.conversationId, feedback.userId]
      );
      conversation = conversationRows[0];
    }

    const [ragLogs] = await mysqlPool.query<AdminRagQueryLogRow[]>(
      `SELECT id, user_id AS userId, conversation_id AS conversationId, message_id AS messageId,
              query, rewritten_query AS rewrittenQuery, top_k AS topK,
              threshold_value AS thresholdValue, hit_count AS hitCount, max_score AS maxScore,
              used_fallback AS usedFallback, latency_ms AS latencyMs, created_at AS createdAt
       FROM rag_query_logs
       WHERE message_id = ? AND user_id = ?
       ORDER BY created_at DESC
       LIMIT 20`,
      [feedback.messageId, feedback.userId]
    );

    const [modelCalls] =
      feedback.conversationId === undefined || feedback.conversationId === null
        ? [[] as AdminModelCallLogRow[]]
        : await mysqlPool.query<AdminModelCallLogRow[]>(
            `SELECT id, user_id AS userId, conversation_id AS conversationId, provider,
                    purpose, status, latency_ms AS latencyMs, token_input AS tokenInput,
                    token_output AS tokenOutput, error_code AS errorCode, created_at AS createdAt
             FROM model_call_logs
             WHERE conversation_id = ? AND user_id = ?
             ORDER BY created_at DESC
             LIMIT 20`,
            [feedback.conversationId, feedback.userId]
          );

    return {
      feedback,
      message,
      conversation,
      ragLogs,
      modelCalls
    };
  },

  async listMessages(query: AdminMessageQuery) {
    const conditions: string[] = [];
    const params: unknown[] = [];
    addBaseConditions(query, conditions, params);

    if (query.role !== undefined) {
      conditions.push("role = ?");
      params.push(query.role);
    }

    if (query.conversationId !== undefined) {
      conditions.push("conversation_id = ?");
      params.push(query.conversationId);
    }

    if (query.keyword !== undefined) {
      const keyword = likePattern(query.keyword);
      conditions.push("(CAST(id AS CHAR) LIKE ? OR CAST(conversation_id AS CHAR) LIKE ? OR role LIKE ? OR content LIKE ?)");
      params.push(keyword, keyword, keyword, keyword);
    }

    const where = buildWhere(conditions);
    const { limit, offset, orderDirection } = pagination(query);
    const total = await countWithParams(`SELECT COUNT(*) AS count FROM messages${where}`, params);
    const [rows] = await mysqlPool.query<RowDataPacket[]>(
      `SELECT id, user_id AS userId, conversation_id AS conversationId,
              role, LEFT(content, 180) AS contentPreview, created_at AS createdAt
       FROM messages
       ${where}
       ORDER BY created_at ${orderDirection}
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    return paginatedResult(rows, total, query);
  },

  async getMessageDetail(messageId: number): Promise<AdminMessageDetail | null> {
    const [messageRows] = await mysqlPool.query<AdminMessageRow[]>(
      `SELECT id, user_id AS userId, conversation_id AS conversationId,
              role, LEFT(content, 180) AS contentPreview, created_at AS createdAt
       FROM messages
       WHERE id = ?
       LIMIT 1`,
      [messageId]
    );

    const message = messageRows[0];
    if (!message) return null;

    const [conversationRows] = await mysqlPool.query<(RowDataPacket & AdminConversationListItem)[]>(
      `SELECT c.id, c.user_id AS userId, c.title, c.summary, c.status,
              (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id) AS messageCount,
              (SELECT MAX(m.created_at) FROM messages m WHERE m.conversation_id = c.id) AS lastMessageAt,
              (SELECT LEFT(m.content, 180)
               FROM messages m
               WHERE m.conversation_id = c.id
               ORDER BY m.created_at DESC, m.id DESC
               LIMIT 1) AS lastMessagePreview,
              c.created_at AS createdAt, c.updated_at AS updatedAt
       FROM conversations c
       WHERE c.id = ? AND c.user_id = ?
       LIMIT 1`,
      [message.conversationId, message.userId]
    );

    const [ragLogs] = await mysqlPool.query<AdminRagQueryLogRow[]>(
      `SELECT id, user_id AS userId, conversation_id AS conversationId, message_id AS messageId,
              query, rewritten_query AS rewrittenQuery, top_k AS topK,
              threshold_value AS thresholdValue, hit_count AS hitCount, max_score AS maxScore,
              used_fallback AS usedFallback, latency_ms AS latencyMs, created_at AS createdAt
       FROM rag_query_logs
       WHERE message_id = ? AND user_id = ?
       ORDER BY created_at DESC
       LIMIT 20`,
      [messageId, message.userId]
    );

    const [feedback] = await mysqlPool.query<AdminFeedbackRow[]>(
      `SELECT f.id, f.user_id AS userId, f.message_id AS messageId,
              m.conversation_id AS conversationId,
              f.rating, f.reason, f.comment,
              LEFT(m.content, 180) AS messagePreview,
              f.created_at AS createdAt
       FROM feedback f
       LEFT JOIN messages m ON m.id = f.message_id
       WHERE f.message_id = ? AND f.user_id = ?
       ORDER BY f.created_at DESC
       LIMIT 20`,
      [messageId, message.userId]
    );

    const [modelCalls] = await mysqlPool.query<AdminModelCallLogRow[]>(
      `SELECT id, user_id AS userId, conversation_id AS conversationId, provider,
              purpose, status, latency_ms AS latencyMs, token_input AS tokenInput,
              token_output AS tokenOutput, error_code AS errorCode, created_at AS createdAt
       FROM model_call_logs
       WHERE conversation_id = ? AND user_id = ?
       ORDER BY created_at DESC
       LIMIT 20`,
      [message.conversationId, message.userId]
    );

    return {
      message,
      conversation: conversationRows[0],
      ragLogs,
      feedback,
      modelCalls
    };
  },

  async listConversations(query: AdminConversationQuery) {
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (query.userId !== undefined) {
      conditions.push("c.user_id = ?");
      params.push(query.userId);
    }

    if (query.createdFrom !== undefined) {
      conditions.push("c.created_at >= ?");
      params.push(query.createdFrom);
    }

    if (query.createdTo !== undefined) {
      conditions.push("c.created_at <= ?");
      params.push(query.createdTo);
    }

    if (query.status !== undefined) {
      conditions.push("c.status = ?");
      params.push(query.status);
    }

    if (query.keyword !== undefined) {
      const keyword = likePattern(query.keyword);
      conditions.push(
        "(CAST(c.id AS CHAR) LIKE ? OR c.title LIKE ? OR c.summary LIKE ? OR c.status LIKE ? OR EXISTS (SELECT 1 FROM messages m WHERE m.conversation_id = c.id AND m.content LIKE ?))"
      );
      params.push(keyword, keyword, keyword, keyword, keyword);
    }

    const where = buildWhere(conditions);
    const { limit, offset, orderDirection } = pagination(query);
    const total = await countWithParams(`SELECT COUNT(*) AS count FROM conversations c${where}`, params);
    const [rows] = await mysqlPool.query<RowDataPacket[]>(
      `SELECT c.id, c.user_id AS userId, c.title, c.summary, c.status,
              (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id) AS messageCount,
              (SELECT MAX(m.created_at) FROM messages m WHERE m.conversation_id = c.id) AS lastMessageAt,
              (SELECT LEFT(m.content, 180)
               FROM messages m
               WHERE m.conversation_id = c.id
               ORDER BY m.created_at DESC, m.id DESC
               LIMIT 1) AS lastMessagePreview,
              c.created_at AS createdAt, c.updated_at AS updatedAt
       FROM conversations c
       ${where}
       ORDER BY c.updated_at ${orderDirection}
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    return paginatedResult(rows, total, query);
  },

  async getConversationDetail(conversationId: number): Promise<AdminConversationDetail | null> {
    const [conversationRows] = await mysqlPool.query<(RowDataPacket & AdminConversationListItem)[]>(
      `SELECT c.id, c.user_id AS userId, c.title, c.summary, c.status,
              (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id) AS messageCount,
              (SELECT MAX(m.created_at) FROM messages m WHERE m.conversation_id = c.id) AS lastMessageAt,
              (SELECT LEFT(m.content, 180)
               FROM messages m
               WHERE m.conversation_id = c.id
               ORDER BY m.created_at DESC, m.id DESC
               LIMIT 1) AS lastMessagePreview,
              c.created_at AS createdAt, c.updated_at AS updatedAt
       FROM conversations c
       WHERE c.id = ?
       LIMIT 1`,
      [conversationId]
    );

    const conversation = conversationRows[0];
    if (!conversation) return null;

    const [messages] = await mysqlPool.query<AdminMessageRow[]>(
      `SELECT id, user_id AS userId, conversation_id AS conversationId,
              role, LEFT(content, 180) AS contentPreview, created_at AS createdAt
       FROM messages
       WHERE conversation_id = ? AND user_id = ?
       ORDER BY created_at ASC, id ASC
       LIMIT 50`,
      [conversationId, conversation.userId]
    );

    const [
      [messageSummaryRows],
      [ragCountRows],
      [ragFallbackRows],
      [feedbackCountRows],
      [downFeedbackRows],
      [auditCountRows],
      [modelCountRows],
      [ragLastRows],
      [feedbackLastRows],
      [auditLastRows],
      [modelLastRows]
    ] = await Promise.all([
      mysqlPool.query<ConversationActivityRow[]>(
        `SELECT
           SUM(role = 'user') AS userMessageCount,
           SUM(role = 'assistant') AS assistantMessageCount,
           MAX(CASE WHEN role = 'user' THEN created_at END) AS lastUserMessageAt,
           MAX(CASE WHEN role = 'assistant' THEN created_at END) AS lastAssistantMessageAt
         FROM messages
         WHERE conversation_id = ? AND user_id = ?`,
        [conversationId, conversation.userId]
      ),
      mysqlPool.query<CountRow[]>(
        `SELECT COUNT(*) AS count
         FROM rag_query_logs
         WHERE conversation_id = ? AND user_id = ?`,
        [conversationId, conversation.userId]
      ),
      mysqlPool.query<CountRow[]>(
        `SELECT SUM(used_fallback = TRUE) AS count
         FROM rag_query_logs
         WHERE conversation_id = ? AND user_id = ?`,
        [conversationId, conversation.userId]
      ),
      mysqlPool.query<CountRow[]>(
        `SELECT COUNT(*) AS count
         FROM feedback f
         INNER JOIN messages m ON m.id = f.message_id
         WHERE m.conversation_id = ? AND f.user_id = ?`,
        [conversationId, conversation.userId]
      ),
      mysqlPool.query<CountRow[]>(
        `SELECT COUNT(*) AS count
         FROM feedback f
         INNER JOIN messages m ON m.id = f.message_id
         WHERE m.conversation_id = ? AND f.user_id = ? AND f.rating = 'down'`,
        [conversationId, conversation.userId]
      ),
      mysqlPool.query<CountRow[]>(
        `SELECT COUNT(*) AS count
         FROM audit_logs
         WHERE user_id = ? AND status = 'blocked'`,
        [conversation.userId]
      ),
      mysqlPool.query<CountRow[]>(
        `SELECT COUNT(*) AS count
         FROM model_call_logs
         WHERE conversation_id = ? AND user_id = ?`,
        [conversationId, conversation.userId]
      ),
      mysqlPool.query<RowDataPacket[]>(
        `SELECT MAX(created_at) AS lastRagQueryAt
         FROM rag_query_logs
         WHERE conversation_id = ? AND user_id = ?`,
        [conversationId, conversation.userId]
      ),
      mysqlPool.query<RowDataPacket[]>(
        `SELECT MAX(f.created_at) AS lastFeedbackAt
         FROM feedback f
         INNER JOIN messages m ON m.id = f.message_id
         WHERE m.conversation_id = ? AND f.user_id = ?`,
        [conversationId, conversation.userId]
      ),
      mysqlPool.query<RowDataPacket[]>(
        `SELECT MAX(created_at) AS lastSafetyBlockAt
         FROM audit_logs
         WHERE user_id = ? AND status = 'blocked'`,
        [conversation.userId]
      ),
      mysqlPool.query<RowDataPacket[]>(
        `SELECT MAX(created_at) AS lastModelCallAt
         FROM model_call_logs
         WHERE conversation_id = ? AND user_id = ?`,
        [conversationId, conversation.userId]
      )
    ]);

    const summaryRow = messageSummaryRows[0];
    const summary: AdminConversationActivitySummary = {
      userMessageCount: Number(summaryRow?.userMessageCount ?? 0),
      assistantMessageCount: Number(summaryRow?.assistantMessageCount ?? 0),
      ragQueryCount: Number(ragCountRows[0]?.count ?? 0),
      fallbackCount: Number(ragFallbackRows[0]?.count ?? 0),
      feedbackCount: Number(feedbackCountRows[0]?.count ?? 0),
      downFeedbackCount: Number(downFeedbackRows[0]?.count ?? 0),
      safetyBlockCount: Number(auditCountRows[0]?.count ?? 0),
      modelCallCount: Number(modelCountRows[0]?.count ?? 0),
      lastUserMessageAt: summaryRow?.lastUserMessageAt ?? undefined,
      lastAssistantMessageAt: summaryRow?.lastAssistantMessageAt ?? undefined,
      lastRagQueryAt: (ragLastRows[0] as RowDataPacket & { lastRagQueryAt?: string | null })?.lastRagQueryAt ?? undefined,
      lastFeedbackAt: (feedbackLastRows[0] as RowDataPacket & { lastFeedbackAt?: string | null })?.lastFeedbackAt ?? undefined,
      lastSafetyBlockAt: (auditLastRows[0] as RowDataPacket & { lastSafetyBlockAt?: string | null })?.lastSafetyBlockAt ?? undefined,
      lastModelCallAt: (modelLastRows[0] as RowDataPacket & { lastModelCallAt?: string | null })?.lastModelCallAt ?? undefined
    };

    return {
      conversation,
      messages,
      summary
    };
  },

  async listFiles(query: AdminFileQuery) {
    const conditions: string[] = [];
    const params: unknown[] = [];
    addBaseConditions(query, conditions, params);

    if (query.fileType !== undefined) {
      conditions.push("file_type = ?");
      params.push(query.fileType);
    }

    if (query.status !== undefined) {
      conditions.push("status = ?");
      params.push(query.status);
    }

    if (query.ingestMode !== undefined) {
      conditions.push("ingest_mode = ?");
      params.push(query.ingestMode);
    }

    if (query.keyword !== undefined) {
      const keyword = likePattern(query.keyword);
      conditions.push(
        "(CAST(id AS CHAR) LIKE ? OR CAST(user_id AS CHAR) LIKE ? OR file_name LIKE ? OR file_type LIKE ? OR status LIKE ? OR checksum LIKE ? OR ingest_mode LIKE ?)"
      );
      params.push(keyword, keyword, keyword, keyword, keyword, keyword, keyword);
    }

    const where = buildWhere(conditions);
    const { limit, offset, orderDirection } = pagination(query);
    const total = await countWithParams(`SELECT COUNT(*) AS count FROM knowledge_files${where}`, params);
    const [rows] = await mysqlPool.query<RowDataPacket[]>(
      `SELECT id, user_id AS userId, file_name AS fileName, file_size AS fileSize,
              file_type AS fileType, checksum, ingest_mode AS ingestMode, status,
              chunk_count AS chunkCount, created_at AS createdAt, updated_at AS updatedAt
       FROM knowledge_files
       ${where}
       ORDER BY created_at ${orderDirection}
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    return paginatedResult(rows, total, query);
  },

  async getFileDetail(fileId: number): Promise<AdminFileDetail | null> {
    const [fileRows] = await mysqlPool.query<AdminFileRow[]>(
      `SELECT id, user_id AS userId, file_name AS fileName, file_size AS fileSize,
              file_type AS fileType, checksum, ingest_mode AS ingestMode, status,
              chunk_count AS chunkCount, created_at AS createdAt, updated_at AS updatedAt
       FROM knowledge_files
       WHERE id = ?
       LIMIT 1`,
      [fileId]
    );

    const file = fileRows[0];
    if (!file) return null;

    const [taskRows] = await mysqlPool.query<AdminFileIngestTaskRow[]>(
      `SELECT id, file_id AS fileId, user_id AS userId, task_type AS taskType,
              status, progress, error_code AS errorCode, error_message AS errorMessage,
              created_at AS createdAt, finished_at AS finishedAt
       FROM ingest_tasks
       WHERE file_id = ?
       ORDER BY created_at DESC
       LIMIT 20`,
      [fileId]
    );

    const [[activityRows], [statusRows]] = await Promise.all([
      mysqlPool.query<FileActivityRow[]>(
        `SELECT COUNT(*) AS taskCount,
                SUM(status = 'completed') AS completedTaskCount,
                SUM(status = 'failed') AS failedTaskCount,
                SUM(status NOT IN ('completed', 'failed')) AS processingTaskCount,
                MAX(created_at) AS lastTaskAt,
                MAX(CASE WHEN status = 'completed' THEN created_at END) AS lastCompletedAt,
                MAX(CASE WHEN status = 'failed' THEN created_at END) AS lastFailedAt
         FROM ingest_tasks
         WHERE file_id = ?`,
        [fileId]
      ),
      mysqlPool.query<DistributionRow[]>(
        `SELECT status AS label, COUNT(*) AS count
         FROM ingest_tasks
         WHERE file_id = ?
         GROUP BY status`,
        [fileId]
      )
    ]);

    const activity = activityRows[0];
    const latestTask = taskRows[0];
    const summary: AdminFileActivitySummary = {
      taskCount: Number(activity?.taskCount ?? 0),
      completedTaskCount: Number(activity?.completedTaskCount ?? 0),
      failedTaskCount: Number(activity?.failedTaskCount ?? 0),
      processingTaskCount: Number(activity?.processingTaskCount ?? 0),
      chunkCount: Number(file.chunkCount ?? 0),
      ingestTasksByStatus: toDistribution(statusRows),
      latestTaskStatus: latestTask?.status,
      latestTaskProgress: latestTask?.progress,
      lastTaskAt: activity?.lastTaskAt ?? undefined,
      lastCompletedAt: activity?.lastCompletedAt ?? undefined,
      lastFailedAt: activity?.lastFailedAt ?? undefined
    };

    return {
      file,
      ingestTasks: taskRows,
      summary
    };
  },

  async listAuditLogs(query: AdminAuditLogQuery) {
    const conditions: string[] = [];
    const params: unknown[] = [];
    addBaseConditions(query, conditions, params);

    if (query.action !== undefined) {
      conditions.push("action = ?");
      params.push(query.action);
    }

    if (query.riskLevel !== undefined) {
      conditions.push("risk_level = ?");
      params.push(query.riskLevel);
    }

    if (query.status !== undefined) {
      conditions.push("status = ?");
      params.push(query.status);
    }

    if (query.keyword !== undefined) {
      const keyword = likePattern(query.keyword);
      conditions.push(
        "(CAST(id AS CHAR) LIKE ? OR action LIKE ? OR target_type LIKE ? OR risk_level LIKE ? OR status LIKE ? OR error_code LIKE ?)"
      );
      params.push(keyword, keyword, keyword, keyword, keyword, keyword);
    }

    const where = buildWhere(conditions);
    const { limit, offset, orderDirection } = pagination(query);
    const total = await countWithParams(`SELECT COUNT(*) AS count FROM audit_logs${where}`, params);
    const [rows] = await mysqlPool.query<RowDataPacket[]>(
      `SELECT id, user_id AS userId, action, target_type AS targetType,
              target_id AS targetId, risk_level AS riskLevel, status,
              error_code AS errorCode, ip, user_agent AS userAgent, created_at AS createdAt
       FROM audit_logs
       ${where}
       ORDER BY created_at ${orderDirection}
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );
    return paginatedResult(rows, total, query);
  },

  async getAuditLogDetail(logId: number): Promise<AdminAuditLogDetail | null> {
    const [logRows] = await mysqlPool.query<AdminAuditLogRow[]>(
      `SELECT id, user_id AS userId, action, target_type AS targetType,
              target_id AS targetId, risk_level AS riskLevel, status,
              error_code AS errorCode, ip, user_agent AS userAgent, created_at AS createdAt
       FROM audit_logs
       WHERE id = ?
       LIMIT 1`,
      [logId]
    );

    const log = logRows[0];
    if (!log) return null;

    const [userRows] =
      log.userId === undefined || log.userId === null
        ? [[] as AdminUserRow[]]
        : await mysqlPool.query<AdminUserRow[]>(
            `SELECT id, username, role, status, created_at AS createdAt, updated_at AS updatedAt
             FROM users
             WHERE id = ?
             LIMIT 1`,
            [log.userId]
          );

    const [targetMessageRows] =
      log.targetType === "message" && log.targetId !== undefined && log.targetId !== null
        ? await mysqlPool.query<AdminMessageRow[]>(
            `SELECT id, user_id AS userId, conversation_id AS conversationId,
                    role, LEFT(content, 180) AS contentPreview, created_at AS createdAt
             FROM messages
             WHERE id = ? AND user_id = ?
             LIMIT 1`,
            [log.targetId, log.userId]
          )
        : [[] as AdminMessageRow[]];

    const [targetFileRows] =
      log.targetType === "file" && log.targetId !== undefined && log.targetId !== null
        ? await mysqlPool.query<AdminFileRow[]>(
            `SELECT id, user_id AS userId, file_name AS fileName, file_size AS fileSize,
                    file_type AS fileType, checksum, ingest_mode AS ingestMode, status,
                    chunk_count AS chunkCount, created_at AS createdAt, updated_at AS updatedAt
             FROM knowledge_files
             WHERE id = ? AND user_id = ?
             LIMIT 1`,
            [log.targetId, log.userId]
          )
        : [[] as AdminFileRow[]];

    const [targetUserRows] =
      log.targetType === "user" && log.targetId !== undefined && log.targetId !== null
        ? await mysqlPool.query<AdminUserRow[]>(
            `SELECT id, username, role, status, created_at AS createdAt, updated_at AS updatedAt
             FROM users
             WHERE id = ?
             LIMIT 1`,
            [log.targetId]
          )
        : [[] as AdminUserRow[]];

    return {
      log,
      user: userRows[0],
      targetUser: targetUserRows[0],
      targetMessage: targetMessageRows[0] as AdminMessageListItem | undefined,
      targetFile: targetFileRows[0]
    };
  }
};
