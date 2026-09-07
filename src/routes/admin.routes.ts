import Router from "@koa/router";
import { requirePermission } from "../middlewares/rbac.middleware.js";
import {
  adminAuditLogQuerySchema,
  adminConversationQuerySchema,
  adminDashboardBreakdownQuerySchema,
  adminDashboardTrendQuerySchema,
  adminFileQuerySchema,
  adminFeedbackQuerySchema,
  adminIdParamSchema,
  adminIngestTaskQuerySchema,
  adminMessageQuerySchema,
  adminModelCallLogQuerySchema,
  adminRagQueryLogQuerySchema,
  adminSecurityOverviewQuerySchema,
  adminUserSecurityEventQuerySchema,
  adminUserStatusUpdateSchema,
  adminUserQuerySchema
} from "../schemas/admin.schema.js";
import { adminService } from "../services/admin.service.js";

export const adminRouter = new Router({ prefix: "/api/admin" });

adminRouter.use(requirePermission("admin:read"));
const canReadDashboard = requirePermission("admin:dashboard:read");
const canReadUsers = requirePermission("admin:users:read");
const canWriteUsers = requirePermission("admin:users:write");
const canReadIngestTasks = requirePermission("admin:ingest-tasks:read");
const canReadModelLogs = requirePermission("admin:model-logs:read");
const canReadRagLogs = requirePermission("admin:rag-logs:read");
const canReadFeedback = requirePermission("admin:feedback:read");
const canReadMessages = requirePermission("admin:messages:read");
const canReadConversations = requirePermission("admin:conversations:read");
const canReadFiles = requirePermission("admin:files:read");
const canReadAuditLogs = requirePermission("admin:audit-logs:read");

adminRouter.get("/dashboard/metrics", canReadDashboard, async (ctx) => {
  ctx.body = { success: true, data: await adminService.getDashboardMetrics() };
});

adminRouter.get("/dashboard/trends", canReadDashboard, async (ctx) => {
  const query = adminDashboardTrendQuerySchema.parse(ctx.query);
  ctx.body = { success: true, data: await adminService.getDashboardTrends(query) };
});

adminRouter.get("/dashboard/breakdowns", canReadDashboard, async (ctx) => {
  const query = adminDashboardBreakdownQuerySchema.parse(ctx.query);
  ctx.body = { success: true, data: await adminService.getDashboardBreakdowns(query) };
});

adminRouter.get("/users", canReadUsers, async (ctx) => {
  const query = adminUserQuerySchema.parse(ctx.query);
  ctx.body = { success: true, data: await adminService.listUsers(query) };
});

adminRouter.get("/users/:id", canReadUsers, async (ctx) => {
  const params = adminIdParamSchema.parse(ctx.params);
  ctx.body = { success: true, data: await adminService.getUserDetail(params.id) };
});

adminRouter.patch("/users/:id/status", canReadUsers, canWriteUsers, async (ctx) => {
  const params = adminIdParamSchema.parse(ctx.params);
  const request = adminUserStatusUpdateSchema.parse(ctx.request.body);
  ctx.body = {
    success: true,
    data: await adminService.updateUserStatus(params.id, request, ctx.state.user.id, ctx)
  };
});

adminRouter.get("/users/:id/activity-summary", canReadUsers, async (ctx) => {
  const params = adminIdParamSchema.parse(ctx.params);
  ctx.body = { success: true, data: await adminService.getUserActivitySummary(params.id) };
});

adminRouter.get("/users/:id/security-events", canReadUsers, canReadAuditLogs, async (ctx) => {
  const params = adminIdParamSchema.parse(ctx.params);
  const query = adminUserSecurityEventQuerySchema.parse(ctx.query);
  ctx.body = { success: true, data: await adminService.getUserSecurityEvents(params.id, query) };
});

adminRouter.get("/ingest-tasks", canReadIngestTasks, async (ctx) => {
  const query = adminIngestTaskQuerySchema.parse(ctx.query);
  ctx.body = { success: true, data: await adminService.listIngestTasks(query) };
});

adminRouter.get("/ingest-tasks/:id", canReadIngestTasks, async (ctx) => {
  const params = adminIdParamSchema.parse(ctx.params);
  ctx.body = { success: true, data: await adminService.getIngestTaskDetail(params.id) };
});

adminRouter.get("/model-call-logs", canReadModelLogs, async (ctx) => {
  const query = adminModelCallLogQuerySchema.parse(ctx.query);
  ctx.body = { success: true, data: await adminService.listModelCallLogs(query) };
});

adminRouter.get("/model-call-logs/:id", canReadModelLogs, async (ctx) => {
  const params = adminIdParamSchema.parse(ctx.params);
  ctx.body = { success: true, data: await adminService.getModelCallLogDetail(params.id) };
});

adminRouter.get("/rag-query-logs", canReadRagLogs, async (ctx) => {
  const query = adminRagQueryLogQuerySchema.parse(ctx.query);
  ctx.body = { success: true, data: await adminService.listRagQueryLogs(query) };
});

adminRouter.get("/rag-query-logs/:id", canReadRagLogs, async (ctx) => {
  const params = adminIdParamSchema.parse(ctx.params);
  ctx.body = { success: true, data: await adminService.getRagQueryLogDetail(params.id) };
});

adminRouter.get("/feedback-stats", canReadFeedback, async (ctx) => {
  ctx.body = { success: true, data: await adminService.getFeedbackStats() };
});

adminRouter.get("/feedback", canReadFeedback, async (ctx) => {
  const query = adminFeedbackQuerySchema.parse(ctx.query);
  ctx.body = { success: true, data: await adminService.listFeedback(query) };
});

adminRouter.get("/feedback/:id", canReadFeedback, async (ctx) => {
  const params = adminIdParamSchema.parse(ctx.params);
  ctx.body = { success: true, data: await adminService.getFeedbackDetail(params.id) };
});

adminRouter.get("/security/overview", canReadAuditLogs, async (ctx) => {
  const query = adminSecurityOverviewQuerySchema.parse(ctx.query);
  ctx.body = { success: true, data: await adminService.getSecurityOverview(query) };
});

adminRouter.get("/messages", canReadMessages, async (ctx) => {
  const query = adminMessageQuerySchema.parse(ctx.query);
  ctx.body = { success: true, data: await adminService.listMessages(query) };
});

adminRouter.get("/messages/:id", canReadMessages, async (ctx) => {
  const params = adminIdParamSchema.parse(ctx.params);
  ctx.body = { success: true, data: await adminService.getMessageDetail(params.id) };
});

adminRouter.get("/conversations", canReadConversations, async (ctx) => {
  const query = adminConversationQuerySchema.parse(ctx.query);
  ctx.body = { success: true, data: await adminService.listConversations(query) };
});

adminRouter.get("/conversations/:id", canReadConversations, async (ctx) => {
  const params = adminIdParamSchema.parse(ctx.params);
  ctx.body = { success: true, data: await adminService.getConversationDetail(params.id) };
});

adminRouter.get("/files", canReadFiles, async (ctx) => {
  const query = adminFileQuerySchema.parse(ctx.query);
  ctx.body = { success: true, data: await adminService.listFiles(query) };
});

adminRouter.get("/files/:id", canReadFiles, async (ctx) => {
  const params = adminIdParamSchema.parse(ctx.params);
  ctx.body = { success: true, data: await adminService.getFileDetail(params.id) };
});

adminRouter.get("/audit-logs", canReadAuditLogs, async (ctx) => {
  const query = adminAuditLogQuerySchema.parse(ctx.query);
  ctx.body = { success: true, data: await adminService.listAuditLogs(query) };
});

adminRouter.get("/audit-logs/:id", canReadAuditLogs, async (ctx) => {
  const params = adminIdParamSchema.parse(ctx.params);
  ctx.body = { success: true, data: await adminService.getAuditLogDetail(params.id) };
});
