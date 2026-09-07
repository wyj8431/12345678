export type KnowledgeFile = {
  id: number;
  userId: number;
  fileName: string;
  fileSize: number;
  fileType: "pdf" | "word" | "excel" | "txt" | "image" | "audio";
  checksum: string;
  ingestMode: "temporary" | "permanent";
  status: "uploaded" | "processing" | "ready" | "failed" | "deleted";
  createdAt: string;
};

export type IngestTask = {
  id: number;
  userId: number;
  fileId: number;
  taskType: "file" | "image" | "audio";
  status: "pending" | "parsing" | "cleaning" | "chunking" | "embedding" | "upserting" | "processing" | "completed" | "failed";
  progress: number;
  errorCode?: string;
  errorMessage?: string;
  createdAt: string;
};

export type ChatMessage = {
  id: number;
  userId: number;
  conversationId: number;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
};

export type Feedback = {
  id: number;
  userId: number;
  messageId: number;
  rating: "up" | "down";
  reason?: "answer_irrelevant" | "wrong_citation" | "incomplete" | "hallucination" | "other";
  comment?: string;
  createdAt: string;
};

export type ModelCallLog = {
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

export type RagQueryLog = {
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

export type AuditLog = {
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

export type MockUser = {
  id: number;
  username?: string;
  role: "user" | "admin";
  status: "active" | "disabled";
  createdAt: string;
  updatedAt: string;
};

export type VectorChunk = {
  id: string;
  userId: number;
  fileId: number;
  fileName: string;
  document: string;
  embedding: number[];
  pageNumber?: number;
  chunkIndex: number;
  createdAt: string;
};

type Store = {
  files: KnowledgeFile[];
  tasks: IngestTask[];
  vectorChunks: VectorChunk[];
  messages: ChatMessage[];
  feedback: Feedback[];
  modelCallLogs: ModelCallLog[];
  ragQueryLogs: RagQueryLog[];
  auditLogs: AuditLog[];
  mockUsers: MockUser[];
  nextFileId: number;
  nextTaskId: number;
  nextMessageId: number;
  nextFeedbackId: number;
  nextModelCallLogId: number;
  nextRagQueryLogId: number;
  nextAuditLogId: number;
};

export const store: Store = {
  files: [],
  tasks: [],
  vectorChunks: [],
  messages: [],
  feedback: [],
  modelCallLogs: [],
  ragQueryLogs: [],
  auditLogs: [],
  mockUsers: [
    {
      id: 2,
      username: "mock-user-2",
      role: "user",
      status: "active",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z"
    }
  ],
  nextFileId: 1,
  nextTaskId: 1,
  nextMessageId: 1,
  nextFeedbackId: 1,
  nextModelCallLogId: 1,
  nextRagQueryLogId: 1,
  nextAuditLogId: 1
};
