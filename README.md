# Zhishu AI API

Koa2 + TypeScript backend for the “智枢AI智能知识库问答平台”.

The current implementation is mock-first, but the service boundaries already match the planned production architecture:

- SSE chat streaming
- Safety review
- Agent decision routing
- RAG retrieval and fallback
- File/image/audio ingestion pipeline
- Mock embedding and vector search
- Chroma REST adapter boundary
- MySQL repository boundary
- Admin dashboard metrics and logs
- Feedback loop

## Quick Start

```bash
npm install
npm run dev
```

Default service URL:

```text
http://127.0.0.1:3001
```

Useful commands:

```bash
npm test
npm run build
npm run smoke
npm audit --audit-level=moderate
```

## CI

GitHub Actions workflow:

```text
.github/workflows/ci.yml
```

The CI pipeline runs `npm ci`, `npm run build`, `npm test`, `npm run smoke`, and `npm audit --audit-level=moderate` on push, pull request, or manual dispatch.

## Docker

Build and run the API image in mock mode:

```bash
docker build -t zhishu-ai-api .
docker run --rm -p 3001:3001 --env USE_MOCK_DB=true --env VECTOR_PROVIDER=mock zhishu-ai-api
```

Run API plus MySQL with Docker Compose:

```bash
docker compose up --build
```

Compose starts the API in mock mode by default, while MySQL is initialized from `migrations/init.sql` for later `USE_MOCK_DB=false` testing. To switch the API container to MySQL mode, set `USE_MOCK_DB=false` in `docker-compose.yml` after the MySQL service is healthy and initialized.

The API image and Compose service use `GET /ready` as the container healthcheck.

On `SIGINT` or `SIGTERM`, the API stops accepting new HTTP connections, closes idle connections, waits for the
server to finish, and releases the MySQL pool. A 10-second forced-exit guard is kept for stuck shutdowns.

## Environment

Copy `.env.example` and adjust values when needed.

Important defaults:

```env
PORT=3001
USE_MOCK_DB=true
VECTOR_PROVIDER=mock
DEFAULT_USER_ID=1
DEFAULT_USER_ROLE=admin
AUTH_JWT_SECRET=dev-secret-change-me
AUTH_TOKEN_TTL_SECONDS=86400
MOCK_ADMIN_USERNAME=admin
MOCK_ADMIN_PASSWORD=admin123456
```

Auth now supports `POST /api/auth/login` with HS256 JWT access tokens. In mock mode, requests without `Authorization` still fall back to `DEFAULT_USER_ID` and `DEFAULT_USER_ROLE` so local smoke tests and quick demos remain zero setup. In MySQL mode, protected APIs require `Authorization: Bearer <accessToken>`.

The default `AUTH_JWT_SECRET` is development-only. Change it before any shared or production deployment.

## Data Modes

### Mock Mode

Keep this for local development:

```env
USE_MOCK_DB=true
VECTOR_PROVIDER=mock
```

Mock mode stores files, ingest tasks, messages, feedback, audit logs, RAG logs, model logs, and vector chunks in memory.

### MySQL Mode

MySQL repositories are scaffolded. Enable only after creating the database and applying `migrations/init.sql`.

```sql
CREATE DATABASE zhishu_ai DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

Then set:

```env
USE_MOCK_DB=false
MYSQL_HOST=127.0.0.1
MYSQL_PORT=3306
MYSQL_USER=root
MYSQL_PASSWORD=replace_me
MYSQL_DATABASE=zhishu_ai
```

### Vector Mode

Default vector mode is mock:

```env
VECTOR_PROVIDER=mock
```

Chroma adapter config is already reserved:

```env
VECTOR_PROVIDER=chroma
CHROMA_BASE_URL=http://127.0.0.1:8000
CHROMA_TENANT=default_tenant
CHROMA_DATABASE=default_database
CHROMA_COLLECTION_ID=zhishu_chunks
CHROMA_TOKEN=
```

Vector metadata is isolated by `user_id` and `file_id`. File deletion also deletes vector chunks.

## Response Envelope

Normal JSON APIs return:

```json
{
  "success": true,
  "data": {}
}
```

Validation and service errors return:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_001",
    "message": "参数错误"
  }
}
```

The chat API uses SSE and emits `data: {...}` events.

## API Reference

### Health

`GET /health`

Response:

```json
{
  "success": true,
  "data": {
    "status": "ok"
  }
}
```

### Readiness

`GET /ready`

Mock mode response:

```json
{
  "success": true,
  "data": {
    "status": "ready",
    "checks": {
      "app": "ok",
      "mysql": "skipped",
      "vector": "skipped"
    }
  }
}
```

When `USE_MOCK_DB=false`, readiness checks MySQL with `SELECT 1`. A failed dependency returns HTTP `503`.

### Auth Login

`POST /api/auth/login`

Mock mode credentials:

```text
admin / admin123456
```

Request body:

```json
{
  "username": "admin",
  "password": "admin123456"
}
```

Response:

```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIs...",
    "tokenType": "Bearer",
    "expiresAt": "2026-07-17T03:30:00.000Z",
    "user": {
      "id": 1,
      "username": "admin",
      "role": "admin",
      "status": "active",
      "permissions": [
        "auth:read",
        "chat:write",
        "files:write",
        "feedback:write",
        "admin:read",
        "admin:dashboard:read"
      ]
    }
  }
}
```

Use the returned token on protected APIs:

```http
Authorization: Bearer <accessToken>
```

In MySQL mode, user passwords must be stored in `users.password_hash` as `scrypt$<salt>$<hex>` or the legacy-compatible `sha256$<salt>$<hex>` format. Credential fields are never returned by the API.

### Auth Me

`GET /api/auth/me`

Headers:

```http
Authorization: Bearer <accessToken>
```

Response:

```json
{
  "success": true,
  "data": {
    "user": {
      "id": 1,
      "username": "admin",
      "role": "admin",
      "status": "active",
      "permissions": [
        "auth:read",
        "chat:write",
        "files:write",
        "feedback:write",
        "admin:read",
        "admin:dashboard:read"
      ]
    }
  }
}
```

Use this endpoint after page refresh to restore the backend admin session. It returns only safe identity fields and RBAC permissions.

### Auth Logout

`POST /api/auth/logout`

Headers:

```http
Authorization: Bearer <accessToken>
```

Response:

```json
{
  "success": true,
  "data": {
    "loggedOut": true
  }
}
```

Logout is stateless for the current JWT implementation: the server records an `auth_logout` audit event, and the client should discard the access token locally. Tokens and raw authorization headers are never persisted.

Current permission groups:

- `user`: `auth:read`, `chat:write`, `files:write`, `feedback:write`
- `admin`: all user permissions plus `admin:*:read` permissions for dashboard, users, ingest tasks, model logs, RAG logs, feedback, messages, conversations, files, and audit logs, plus `admin:users:write` for user governance actions

Admin route permissions:

| Route group | Required permission |
| --- | --- |
| `/api/admin/dashboard/*` | `admin:dashboard:read` |
| `/api/admin/users*` | `admin:users:read` |
| `PATCH /api/admin/users/:id/status` | `admin:users:read` + `admin:users:write` |
| `/api/admin/ingest-tasks*` | `admin:ingest-tasks:read` |
| `/api/admin/model-call-logs*` | `admin:model-logs:read` |
| `/api/admin/rag-query-logs*` | `admin:rag-logs:read` |
| `/api/admin/feedback*` and `/api/admin/feedback-stats` | `admin:feedback:read` |
| `/api/admin/messages*` | `admin:messages:read` |
| `/api/admin/conversations*` | `admin:conversations:read` |
| `/api/admin/files*` | `admin:files:read` |
| `/api/admin/audit-logs*` | `admin:audit-logs:read` |

All admin routes also require the base `admin:read` permission before the route-specific permission is checked.

Auth and RBAC audit events:

| Event | Action | Status |
| --- | --- | --- |
| Login success | `auth_login` | `success` |
| Logout success | `auth_logout` | `success` |
| Login invalid credentials | `auth_login` | `failed` |
| Disabled account login | `auth_login` | `blocked` |
| Missing token in MySQL mode | `auth_required` | `failed` |
| Invalid Authorization header | `auth_authorization_header` | `failed` |
| Invalid or expired token | `auth_token_verify` | `failed` |
| Permission denied | `rbac_permission_denied` | `blocked` |
| Admin user status update | `admin_user_status_update` | `success` |

Audit records intentionally store only stable metadata: user id when known, action, target type/id, risk level, status, error code, IP, user agent, and timestamp. Passwords, tokens, raw prompts, Authorization headers, and stack traces are never persisted in audit logs.

### Chat Stream

`POST /api/chat/stream`

Content type:

```text
application/json
```

Request body:

```json
{
  "conversationId": 1,
  "content": "智枢AI是什么？",
  "inputType": "text",
  "fileIds": [1],
  "temporaryContext": "可选。本轮临时 OCR/ASR/图片解析文本。"
}
```

Field rules:

- `conversationId`: optional positive integer
- `content`: required string, 1-8000 chars
- `inputType`: `text | audio | file | image`, default `text`
- `fileIds`: optional positive integer array, max 20
- `temporaryContext`: optional string, max 20000 chars

Agent routing:

- `temporary_context`: when `temporaryContext` is provided; skips RAG retrieval
- `scoped_rag`: when `fileIds` is provided; retrieves only those files
- `global_rag`: default full knowledge-base retrieval

SSE event sequence examples:

```text
data: {"type":"progress","stage":"safety"}
data: {"type":"start","conversationId":1,"messageId":2}
data: {"type":"progress","stage":"agent"}
data: {"type":"agent_decision","data":{"mode":"global_rag","shouldRetrieve":true,"reason":"default_knowledge_base_search"}}
data: {"type":"progress","stage":"retrieval"}
data: {"type":"references","data":[{"fileId":1,"fileName":"prd.txt","pageNumber":1,"chunkIndex":0,"score":0.91,"quotePreview":"..."}]}
data: {"type":"progress","stage":"generation"}
data: {"type":"content","delta":"根"}
data: {"type":"done","usage":{"latencyMs":900,"provider":"mock-rag"}}
```

Safety block example:

```text
data: {"type":"progress","stage":"safety"}
data: {"type":"error","error":{"code":"SAFETY_BLOCKED","message":"Input was blocked by safety policy"}}
```

PowerShell curl example:

```powershell
'{ "content": "\u667a\u67a2AI\u662f\u4ec0\u4e48\uff1f", "inputType": "text" }' |
  curl.exe -N -X POST "http://127.0.0.1:3001/api/chat/stream" `
    -H "Content-Type: application/json; charset=utf-8" `
    --data-binary "@-"
```

### Init Upload

`POST /api/files/init`

Request:

```json
{
  "fileName": "prd.txt",
  "fileSize": 1024,
  "fileType": "txt",
  "checksum": "abc123456",
  "ingestMode": "permanent"
}
```

Field rules:

- `fileType`: `pdf | word | excel | txt | image | audio`
- `ingestMode`: `temporary | permanent`, default `permanent`
- max file size enforced by service: 50 MB

Response:

```json
{
  "success": true,
  "data": {
    "uploadId": "generated-upload-id",
    "chunkSize": 2097152
  }
}
```

### Complete Upload

`POST /api/files/complete`

Request:

```json
{
  "uploadId": "upload-test-001",
  "fileName": "prd.txt",
  "fileSize": 1024,
  "fileType": "txt",
  "checksum": "abc123456",
  "ingestMode": "permanent"
}
```

Response:

```json
{
  "success": true,
  "data": {
    "fileId": 1,
    "taskId": 1,
    "status": "processing"
  }
}
```

The service then runs an async ingestion pipeline:

```text
parsing -> cleaning -> chunking -> embedding -> upserting -> completed
```

In mock mode, the pipeline creates searchable in-memory vector chunks.

### List Files

`GET /api/files`

Response:

```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "userId": 1,
      "fileName": "prd.txt",
      "fileSize": 1024,
      "fileType": "txt",
      "checksum": "abc123456",
      "ingestMode": "permanent",
      "status": "ready",
      "createdAt": "2026-07-15T13:15:57.812Z"
    }
  ]
}
```

### Delete File

`DELETE /api/files/:id`

Response:

```json
{
  "success": true,
  "data": {
    "deleted": true
  }
}
```

Deletion also removes vector chunks for the same `userId` and `fileId`.

### Get Ingest Task

`GET /api/ingest-tasks/:id`

Response:

```json
{
  "success": true,
  "data": {
    "id": 1,
    "userId": 1,
    "fileId": 1,
    "taskType": "file",
    "status": "completed",
    "progress": 100,
    "createdAt": "2026-07-15T13:15:57.812Z"
  }
}
```

Possible task statuses:

```text
pending | parsing | cleaning | chunking | embedding | upserting | processing | completed | failed
```

### Create Feedback

`POST /api/feedback`

Feedback can only be submitted for assistant messages.

Request:

```json
{
  "messageId": 2,
  "rating": "down",
  "reason": "wrong_citation",
  "comment": "引用来源不准确"
}
```

Field rules:

- `rating`: `up | down`
- `reason`: `answer_irrelevant | wrong_citation | incomplete | hallucination | other`
- `comment`: optional, max 512 chars

Response:

```json
{
  "success": true,
  "data": {
    "id": 1,
    "userId": 1,
    "messageId": 2,
    "rating": "down",
    "reason": "wrong_citation",
    "comment": "引用来源不准确",
    "createdAt": "2026-07-15T13:15:57.812Z"
  }
}
```

## Admin APIs

Admin APIs require role `admin`. In mock mode this comes from `DEFAULT_USER_ROLE=admin`; in token mode it comes from the JWT returned by `POST /api/auth/login`.

Admin list endpoints support these common query parameters:

| Parameter | Type | Default | Notes |
| --- | --- | --- | --- |
| `page` | integer | `1` | Starts from 1 |
| `pageSize` | integer | `20` | Max 100 |
| `sortOrder` | `asc \| desc` | `desc` | Sorts by `createdAt` |
| `keyword` | string | - | Searches key text fields |
| `userId` | integer | - | Admin-only user filter |
| `createdFrom` | ISO datetime | - | Inclusive |
| `createdTo` | ISO datetime | - | Inclusive |

Admin list endpoints return:

```json
{
  "success": true,
  "data": {
    "items": [],
    "total": 0,
    "page": 1,
    "pageSize": 20,
    "totalPages": 1
  }
}
```

### Dashboard Metrics

`GET /api/admin/dashboard/metrics`

Response:

```json
{
  "success": true,
  "data": {
    "chatCount": 1,
    "modelCallCount": 1,
    "ragHitRate": 1,
    "fallbackRate": 0,
    "ingestSuccessRate": 1,
    "safetyBlockCount": 0,
    "feedbackStats": {
      "up": 0,
      "down": 1,
      "downReasons": {
        "wrong_citation": 1
      }
    }
  }
}
```

### Dashboard Trends

`GET /api/admin/dashboard/trends?days=7`

Returns daily dashboard trend points for charts. `days` supports `1-90` and defaults to `7`.

Response:

```json
{
  "success": true,
  "data": {
    "days": 7,
    "points": [
      {
        "date": "2026-07-16",
        "chatCount": 2,
        "modelCallCount": 2,
        "avgModelLatencyMs": 30,
        "ragQueryCount": 1,
        "fallbackCount": 0,
        "fallbackRate": 0,
        "safetyBlockCount": 1,
        "feedbackCount": 1
      }
    ]
  }
}
```

### Dashboard Breakdowns

`GET /api/admin/dashboard/breakdowns?days=7`

Returns recent dashboard distributions for chart widgets. `days` supports `1-90` and defaults to `7`.

Response:

```json
{
  "success": true,
  "data": {
    "days": 7,
    "filesByStatus": {
      "ready": 1
    },
    "ingestTasksByStatus": {
      "completed": 1
    },
    "modelCallsByStatus": {
      "success": 2
    },
    "modelCallsByPurpose": {
      "chat": 2
    },
    "ragFallback": {
      "fallback": 0,
      "nonFallback": 1
    },
    "feedbackByRating": {
      "down": 1
    },
    "feedbackDownReasons": {
      "wrong_citation": 1
    },
    "auditByRiskLevel": {
      "high": 1
    },
    "auditByStatus": {
      "blocked": 1
    }
  }
}
```

### Security Overview

`GET /api/admin/security/overview?days=7`

Returns audit and security aggregates for the admin security page. `days` supports `1-90` and defaults to `7`. The response contains counts, distributions, top actions, and recent high-risk audit previews only; it never returns passwords, tokens, raw authorization headers, raw prompts, stack traces, full message content, retrieved context, chunk text, or embeddings.

Response:

```json
{
  "success": true,
  "data": {
    "days": 7,
    "totalAuditCount": 12,
    "successCount": 7,
    "failedCount": 2,
    "blockedCount": 3,
    "highRiskCount": 3,
    "authFailureCount": 2,
    "permissionDeniedCount": 1,
    "safetyBlockCount": 2,
    "uniqueUserCount": 4,
    "auditByRiskLevel": {
      "low": 7,
      "medium": 2,
      "high": 3
    },
    "auditByStatus": {
      "success": 7,
      "failed": 2,
      "blocked": 3
    },
    "topActions": [
      {
        "action": "chat_safety_check",
        "count": 3,
        "failedCount": 0,
        "blockedCount": 2,
        "lastSeenAt": "2026-07-16T00:00:00.000Z"
      }
    ],
    "recentHighRiskLogs": []
  }
}
```

### User List

`GET /api/admin/users`

Returns paginated users for the admin user table. It includes safe profile fields plus lightweight operational counts; `password_hash` and other credential fields are never returned.

Extra filters:

- `role`: `user | admin`
- `status`: `active | disabled`

Response:

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": 1,
        "username": "mock-user-1",
        "role": "admin",
        "status": "active",
        "conversationCount": 1,
        "messageCount": 2,
        "fileCount": 1,
        "feedbackCount": 1,
        "lastActiveAt": "2026-07-16T00:00:00.000Z"
      }
    ],
    "total": 1,
    "page": 1,
    "pageSize": 20,
    "totalPages": 1
  }
}
```

### User Detail

`GET /api/admin/users/:id`

Returns one user's safe base profile. Use `GET /api/admin/users/:id/activity-summary` when the page needs recent operational records.

Response:

```json
{
  "success": true,
  "data": {
    "user": {
      "id": 1,
      "username": "mock-user-1",
      "role": "admin",
      "status": "active",
      "createdAt": "2026-07-16T00:00:00.000Z",
      "updatedAt": "2026-07-16T00:00:00.000Z"
    }
  }
}
```

### User Activity Summary

`GET /api/admin/users/:id/activity-summary`

Returns one user's operational footprint for the admin user detail page. The response includes aggregate counts plus the 5 most recent conversations, files, feedback records, and audit logs. It intentionally returns previews and summaries only; raw prompts, full messages, retrieved context, embeddings, storage paths, stack traces, and secrets are not exposed.

Response:

```json
{
  "success": true,
  "data": {
    "user": {
      "id": 1,
      "username": "mock-user-1",
      "role": "user",
      "status": "active"
    },
    "metrics": {
      "conversationCount": 1,
      "messageCount": 2,
      "fileCount": 1,
      "readyFileCount": 1,
      "feedbackCount": 1,
      "downFeedbackCount": 1,
      "auditLogCount": 1,
      "safetyBlockCount": 1,
      "ragQueryCount": 1,
      "modelCallCount": 1
    },
    "recentConversations": [],
    "recentFiles": [],
    "recentFeedback": [],
    "recentAuditLogs": []
  }
}
```

### User Security Events

`GET /api/admin/users/:id/security-events?days=30&page=1&pageSize=20`

Returns one user's security and audit event timeline for the admin user detail page. Requires both user-read and audit-log-read permissions. Extra filters: `action`, `riskLevel`, `status`, and `keyword`. The response includes aggregate counts and paginated safe audit previews only; it does not expose passwords, tokens, raw authorization headers, raw prompts, full messages, retrieved context, chunk text, embeddings, stack traces, or internal payloads.

Response:

```json
{
  "success": true,
  "data": {
    "user": {
      "id": 1,
      "username": "mock-user-1",
      "role": "admin",
      "status": "active"
    },
    "days": 30,
    "metrics": {
      "totalAuditCount": 3,
      "successCount": 1,
      "failedCount": 1,
      "blockedCount": 1,
      "highRiskCount": 1,
      "authFailureCount": 1,
      "permissionDeniedCount": 0,
      "safetyBlockCount": 1,
      "lastEventAt": "2026-07-16T00:00:00.000Z"
    },
    "auditByRiskLevel": {
      "low": 1,
      "medium": 1,
      "high": 1
    },
    "auditByStatus": {
      "success": 1,
      "failed": 1,
      "blocked": 1
    },
    "events": {
      "items": [],
      "total": 0,
      "page": 1,
      "pageSize": 20,
      "totalPages": 1
    }
  }
}
```

### Update User Status

`PATCH /api/admin/users/:id/status`

Updates another user's account status for admin governance pages. Requires `admin:users:read` and `admin:users:write`. The current admin user cannot disable their own account; that returns `USER_403_SELF_DISABLE` with HTTP 403. Successful changes write an `admin_user_status_update` audit event with the acting admin as `userId` and the target account as `targetType=user`, `targetId=:id`.

Request:

```json
{
  "status": "disabled"
}
```

Response:

```json
{
  "success": true,
  "data": {
    "user": {
      "id": 2,
      "username": "mock-user-2",
      "role": "user",
      "status": "disabled",
      "createdAt": "2026-01-01T00:00:00.000Z",
      "updatedAt": "2026-07-16T00:00:00.000Z"
    }
  }
}
```

### Ingest Task List

`GET /api/admin/ingest-tasks`

Extra filters:

- `status`: `pending | parsing | cleaning | chunking | embedding | upserting | processing | completed | failed`
- `taskType`: `file | image | audio`
- `fileId`: positive integer

### Ingest Task Detail

`GET /api/admin/ingest-tasks/:id`

Returns one ingest task with its related file summary, same-file task timeline, and safe ingest summary counts. Raw chunk text, embeddings, storage paths, parser payloads, and stack traces are excluded.

Response:

```json
{
  "success": true,
  "data": {
    "task": {
      "id": 1,
      "userId": 1,
      "fileId": 1,
      "taskType": "file",
      "status": "completed",
      "progress": 100,
      "createdAt": "2026-07-16T00:00:00.000Z"
    },
    "file": {
      "id": 1,
      "userId": 1,
      "fileName": "prd.txt",
      "fileSize": 1024,
      "fileType": "txt",
      "checksum": "abc123456",
      "ingestMode": "permanent",
      "status": "ready",
      "chunkCount": 3,
      "createdAt": "2026-07-16T00:00:00.000Z",
      "updatedAt": "2026-07-16T00:00:00.000Z"
    },
    "relatedTasks": [
      {
        "id": 1,
        "userId": 1,
        "fileId": 1,
        "taskType": "file",
        "status": "completed",
        "progress": 100,
        "createdAt": "2026-07-16T00:00:00.000Z"
      }
    ],
    "summary": {
      "taskCount": 1,
      "completedTaskCount": 1,
      "failedTaskCount": 0,
      "processingTaskCount": 0,
      "chunkCount": 3,
      "ingestTasksByStatus": {
        "completed": 1
      },
      "latestTaskStatus": "completed",
      "latestTaskProgress": 100,
      "lastTaskAt": "2026-07-16T00:00:00.000Z",
      "lastCompletedAt": "2026-07-16T00:00:00.000Z"
    }
  }
}
```

### Model Call Logs

`GET /api/admin/model-call-logs`

Extra filters:

- `provider`: exact provider name
- `purpose`: `chat | rewrite_query | summarize | embedding | safety`
- `status`: `success | failed | timeout | aborted`

### Model Call Log Detail

`GET /api/admin/model-call-logs/:id`

Returns one model call log with safe troubleshooting context: related conversation summary, message previews, RAG query logs, and feedback records. It does not return raw prompt, provider payloads, full message content, retrieved context, chunk text, or vector embeddings.

Response:

```json
{
  "success": true,
  "data": {
    "log": {
      "id": 1,
      "userId": 1,
      "conversationId": 1,
      "provider": "mock-model",
      "purpose": "chat",
      "status": "success",
      "latencyMs": 30,
      "tokenInput": 120,
      "tokenOutput": 80,
      "createdAt": "2026-07-16T00:00:00.000Z"
    },
    "conversation": {
      "id": 1,
      "userId": 1,
      "status": "active",
      "messageCount": 2,
      "lastMessagePreview": "Answer preview",
      "createdAt": "2026-07-16T00:00:00.000Z",
      "updatedAt": "2026-07-16T00:00:00.000Z"
    },
    "messages": [
      {
        "id": 10,
        "userId": 1,
        "conversationId": 1,
        "role": "assistant",
        "contentPreview": "Answer preview",
        "createdAt": "2026-07-16T00:00:00.000Z"
      }
    ],
    "ragLogs": [
      {
        "id": 3,
        "userId": 1,
        "conversationId": 1,
        "messageId": 10,
        "query": "knowledge base answer",
        "hitCount": 2,
        "maxScore": 0.91,
        "usedFallback": false,
        "latencyMs": 15,
        "createdAt": "2026-07-16T00:00:00.000Z"
      }
    ],
    "feedback": [
      {
        "id": 7,
        "userId": 1,
        "messageId": 10,
        "conversationId": 1,
        "rating": "down",
        "reason": "incomplete",
        "messagePreview": "Answer preview",
        "createdAt": "2026-07-16T00:00:00.000Z"
      }
    ]
  }
}
```

### RAG Query Logs

`GET /api/admin/rag-query-logs`

Extra filters:

- `usedFallback`: `true | false`

### RAG Query Log Detail

`GET /api/admin/rag-query-logs/:id`

Returns one RAG retrieval log, the related message preview, conversation summary, and feedback records for the same message. It does not return raw vector embeddings, retrieved context, or chunk text.

Response:

```json
{
  "success": true,
  "data": {
    "log": {
      "id": 1,
      "userId": 1,
      "conversationId": 1,
      "messageId": 1,
      "query": "What is Zhishu AI?",
      "topK": 8,
      "thresholdValue": 0.75,
      "hitCount": 2,
      "maxScore": 0.91,
      "usedFallback": false,
      "latencyMs": 18,
      "createdAt": "2026-07-16T00:00:00.000Z"
    },
    "message": {
      "id": 1,
      "userId": 1,
      "conversationId": 1,
      "role": "user",
      "contentPreview": "What is Zhishu AI?",
      "createdAt": "2026-07-16T00:00:00.000Z"
    },
    "conversation": {
      "id": 1,
      "userId": 1,
      "status": "active",
      "messageCount": 2,
      "lastMessagePreview": "Answer preview",
      "createdAt": "2026-07-16T00:00:00.000Z",
      "updatedAt": "2026-07-16T00:00:00.000Z"
    },
    "feedback": []
  }
}
```

### Feedback Stats

`GET /api/admin/feedback-stats`

Response:

```json
{
  "success": true,
  "data": {
    "total": 1,
    "up": 0,
    "down": 1
  }
}
```

### Feedback List

`GET /api/admin/feedback`

Returns paginated feedback details with `messagePreview` for admin review.

Extra filters:

- `rating`: `up | down`
- `reason`: `answer_irrelevant | wrong_citation | incomplete | hallucination | other`
- `messageId`: positive integer

### Feedback Detail

`GET /api/admin/feedback/:id`

Returns one feedback record with the related message preview, conversation summary, RAG logs, and model call logs. Full raw answer text, prompts, retrieved context, and chunk text are intentionally not returned.

Response:

```json
{
  "success": true,
  "data": {
    "feedback": {
      "id": 1,
      "userId": 1,
      "messageId": 1,
      "conversationId": 1,
      "rating": "down",
      "reason": "wrong_citation",
      "comment": "Citation does not match the document.",
      "messagePreview": "Answer preview",
      "createdAt": "2026-07-16T00:00:00.000Z"
    },
    "message": {
      "id": 1,
      "userId": 1,
      "conversationId": 1,
      "role": "assistant",
      "contentPreview": "Answer preview",
      "createdAt": "2026-07-16T00:00:00.000Z"
    },
    "conversation": {
      "id": 1,
      "userId": 1,
      "status": "active",
      "messageCount": 2,
      "lastMessagePreview": "Answer preview",
      "createdAt": "2026-07-16T00:00:00.000Z",
      "updatedAt": "2026-07-16T00:00:00.000Z"
    },
    "ragLogs": [],
    "modelCalls": []
  }
}
```

### Message List

`GET /api/admin/messages`

Returns paginated chat messages with `contentPreview` for admin troubleshooting.

Extra filters:

- `role`: `user | assistant`
- `conversationId`: positive integer

### Message Detail

`GET /api/admin/messages/:id`

Returns one message preview with related conversation summary, RAG query logs, feedback records, and safe model call summaries. Full raw message text, prompts, provider payloads, and retrieved context are intentionally not returned.

Response:

```json
{
  "success": true,
  "data": {
    "message": {
      "id": 1,
      "userId": 1,
      "conversationId": 1,
      "role": "assistant",
      "contentPreview": "Answer preview",
      "createdAt": "2026-07-16T00:00:00.000Z"
    },
    "conversation": {
      "id": 1,
      "userId": 1,
      "status": "active",
      "messageCount": 2,
      "lastMessagePreview": "Answer preview",
      "createdAt": "2026-07-16T00:00:00.000Z",
      "updatedAt": "2026-07-16T00:00:00.000Z"
    },
    "ragLogs": [],
    "feedback": [],
    "modelCalls": [
      {
        "id": 3,
        "userId": 1,
        "conversationId": 1,
        "provider": "mock-model",
        "purpose": "chat",
        "status": "success",
        "latencyMs": 28,
        "tokenInput": 120,
        "tokenOutput": 64,
        "createdAt": "2026-07-16T00:00:00.000Z"
      }
    ]
  }
}
```

### Conversation List

`GET /api/admin/conversations`

Returns paginated conversation summaries with message count, last activity time, and `lastMessagePreview`.

Extra filters:

- `status`: `active | archived | deleted`

### Conversation Detail

`GET /api/admin/conversations/:id`

Returns one conversation summary and up to 50 recent message previews. Full raw message content is intentionally not returned.

Response:

```json
{
  "success": true,
  "data": {
    "conversation": {
      "id": 1,
      "userId": 1,
      "status": "active",
      "messageCount": 2,
      "lastMessagePreview": "Answer preview",
      "createdAt": "2026-07-16T00:00:00.000Z",
      "updatedAt": "2026-07-16T00:00:00.000Z"
    },
    "messages": [
      {
        "id": 1,
        "userId": 1,
        "conversationId": 1,
        "role": "user",
        "contentPreview": "Question preview",
        "createdAt": "2026-07-16T00:00:00.000Z"
      }
    ],
    "summary": {
      "userMessageCount": 1,
      "assistantMessageCount": 1,
      "ragQueryCount": 1,
      "fallbackCount": 0,
      "feedbackCount": 1,
      "downFeedbackCount": 1,
      "safetyBlockCount": 1,
      "modelCallCount": 1,
      "lastUserMessageAt": "2026-07-16T00:00:00.000Z",
      "lastAssistantMessageAt": "2026-07-16T00:00:00.000Z",
      "lastRagQueryAt": "2026-07-16T00:00:00.000Z",
      "lastFeedbackAt": "2026-07-16T00:00:00.000Z",
      "lastSafetyBlockAt": "2026-07-16T00:00:00.000Z",
      "lastModelCallAt": "2026-07-16T00:00:00.000Z"
    }
  }
}
```

### File List

`GET /api/admin/files`

Returns paginated knowledge files for admin review, including file status and `chunkCount`.

Extra filters:

- `fileType`: `pdf | word | excel | txt | image | audio`
- `status`: `uploaded | processing | ready | failed | deleted`
- `ingestMode`: `temporary | permanent`

### File Detail

`GET /api/admin/files/:id`

Returns one knowledge file, its related ingest tasks, and a safe ingest summary. The response intentionally excludes internal storage paths, raw chunk text, and vector embeddings.

Response:

```json
{
  "success": true,
  "data": {
    "file": {
      "id": 1,
      "userId": 1,
      "fileName": "prd.txt",
      "fileSize": 1024,
      "fileType": "txt",
      "checksum": "abc123456",
      "ingestMode": "permanent",
      "status": "ready",
      "chunkCount": 3,
      "createdAt": "2026-07-16T00:00:00.000Z",
      "updatedAt": "2026-07-16T00:00:00.000Z"
    },
    "ingestTasks": [
      {
        "id": 1,
        "userId": 1,
        "fileId": 1,
        "taskType": "file",
        "status": "completed",
        "progress": 100,
        "createdAt": "2026-07-16T00:00:00.000Z"
      }
    ],
    "summary": {
      "taskCount": 1,
      "completedTaskCount": 1,
      "failedTaskCount": 0,
      "processingTaskCount": 0,
      "chunkCount": 3,
      "ingestTasksByStatus": {
        "completed": 1
      },
      "latestTaskStatus": "completed",
      "latestTaskProgress": 100,
      "lastTaskAt": "2026-07-16T00:00:00.000Z",
      "lastCompletedAt": "2026-07-16T00:00:00.000Z"
    }
  }
}
```

### Audit Logs

`GET /api/admin/audit-logs`

Extra filters:

- `action`: exact action name
- `riskLevel`: `low | medium | high`
- `status`: `success | blocked | failed`

### Audit Log Detail

`GET /api/admin/audit-logs/:id`

Returns one safety or operational audit log with safe user and target summaries when available. The response intentionally excludes raw prompts, retrieved context, stack traces, secrets, internal payloads, password hashes, storage paths, full message content, chunk text, and embeddings.

Response:

```json
{
  "success": true,
  "data": {
    "log": {
      "id": 1,
      "userId": 1,
      "action": "chat_safety_check",
      "targetType": "message",
      "riskLevel": "high",
      "status": "blocked",
      "errorCode": "SAFETY_BLOCKED",
      "ip": "127.0.0.1",
      "userAgent": "Mozilla/5.0",
      "createdAt": "2026-07-16T00:00:00.000Z"
    },
    "user": {
      "id": 1,
      "username": "mock-user-1",
      "role": "admin",
      "status": "active",
      "createdAt": "2026-07-16T00:00:00.000Z",
      "updatedAt": "2026-07-16T00:00:00.000Z"
    },
    "targetUser": {
      "id": 2,
      "username": "mock-user-2",
      "role": "user",
      "status": "disabled",
      "createdAt": "2026-07-16T00:00:00.000Z",
      "updatedAt": "2026-07-16T00:00:00.000Z"
    },
    "targetMessage": {
      "id": 12,
      "userId": 1,
      "conversationId": 3,
      "role": "user",
      "contentPreview": "Blocked message preview",
      "createdAt": "2026-07-16T00:00:00.000Z"
    },
    "targetFile": {
      "id": 9,
      "userId": 1,
      "fileName": "security-policy.pdf",
      "fileSize": 1024,
      "fileType": "pdf",
      "checksum": "sha256-demo",
      "ingestMode": "permanent",
      "status": "deleted",
      "chunkCount": 0,
      "createdAt": "2026-07-16T00:00:00.000Z",
      "updatedAt": "2026-07-16T00:00:00.000Z"
    }
  }
}
```

## End-to-End Smoke Flow

Automated smoke test:

```bash
npm run smoke
```

The script builds the project, starts a temporary mock-mode server, verifies upload ingestion, scoped RAG chat, temporary-context chat, safety blocking, feedback, admin metrics, OpenAPI, and `/docs`, then stops the temporary server.

1. Health check:

```bash
curl http://127.0.0.1:3001/health
```

2. Complete mock upload:

```bash
curl -X POST http://127.0.0.1:3001/api/files/complete \
  -H "Content-Type: application/json" \
  -d "{\"uploadId\":\"upload-test-001\",\"fileName\":\"prd.txt\",\"fileSize\":1024,\"fileType\":\"txt\",\"checksum\":\"abc123456\",\"ingestMode\":\"permanent\"}"
```

3. Poll task:

```bash
curl http://127.0.0.1:3001/api/ingest-tasks/1
```

4. Ask with scoped RAG:

```powershell
'{ "content": "\u667a\u67a2AI\u662f\u4ec0\u4e48\uff1f", "inputType": "text", "fileIds": [1] }' |
  curl.exe -N -X POST "http://127.0.0.1:3001/api/chat/stream" `
    -H "Content-Type: application/json; charset=utf-8" `
    --data-binary "@-"
```

## Postman

Import this collection:

```text
docs/postman/zhishu-ai-api.postman_collection.json
```

The collection uses a `baseUrl` variable with default value:

```text
http://127.0.0.1:3001
```

## OpenAPI

Machine-readable API contract:

```text
docs/openapi/zhishu-ai-api.openapi.json
```

The OpenAPI file covers all JSON endpoints and documents the chat endpoint as `text/event-stream`.

Runtime docs endpoints:

```text
GET /docs
GET /openapi.json
```

Suggested run order:

1. `Health`
2. `Files / Complete Upload`
3. `Ingest / Get Task`
4. `Chat / Stream Global RAG`
5. `Chat / Stream Temporary Context`
6. `Admin / Dashboard Metrics`

## Security Notes

- Third-party model keys are not used in the current implementation.
- Future model provider keys must stay backend-only in environment variables.
- SSE streaming listens for client close/abort in the route layer.
- RAG retrieval and vector metadata are scoped by user.
- File deletion synchronizes file metadata and vector chunks.
- Low or zero recall falls back instead of fabricating citations.
