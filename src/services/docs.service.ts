import { readFile } from "node:fs/promises";
import path from "node:path";

const openApiPath = path.join(process.cwd(), "docs", "openapi", "zhishu-ai-api.openapi.json");

export const docsService = {
  async getOpenApiSpec() {
    const rawSpec = await readFile(openApiPath, "utf8");
    return JSON.parse(rawSpec) as unknown;
  },

  getDocsHtml() {
    return `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Zhishu AI API Docs</title>
    <style>
      body {
        margin: 0;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        background: #f7f8fa;
        color: #1f2937;
      }
      main {
        max-width: 920px;
        margin: 0 auto;
        padding: 40px 24px;
      }
      h1 {
        margin: 0 0 12px;
        font-size: 32px;
      }
      p {
        line-height: 1.7;
      }
      a {
        color: #2563eb;
      }
      .panel {
        margin-top: 24px;
        border: 1px solid #d8dee8;
        border-radius: 8px;
        background: white;
        padding: 20px;
      }
      code {
        background: #eef2f7;
        border-radius: 4px;
        padding: 2px 6px;
      }
      ul {
        padding-left: 20px;
      }
    </style>
  </head>
  <body>
    <main>
      <h1>Zhishu AI API Docs</h1>
      <p>智枢AI 后端接口文档入口。当前服务提供 OpenAPI、Postman、README 三种文档形态。</p>
      <section class="panel">
        <h2>Available Documents</h2>
        <ul>
          <li><a href="/openapi.json">OpenAPI JSON</a></li>
          <li><code>docs/postman/zhishu-ai-api.postman_collection.json</code></li>
          <li><code>README.md</code></li>
        </ul>
      </section>
      <section class="panel">
        <h2>Key Endpoints</h2>
        <ul>
          <li><code>GET /health</code></li>
          <li><code>POST /api/auth/login</code></li>
          <li><code>GET /api/auth/me</code></li>
          <li><code>POST /api/auth/logout</code></li>
          <li><code>POST /api/chat/stream</code></li>
          <li><code>POST /api/files/complete</code></li>
          <li><code>GET /api/admin/dashboard/metrics</code></li>
          <li><code>GET /api/admin/dashboard/trends?days=7</code></li>
          <li><code>GET /api/admin/dashboard/breakdowns?days=7</code></li>
          <li><code>GET /api/admin/security/overview?days=7</code></li>
          <li><code>GET /api/admin/users/1/security-events?days=30</code></li>
          <li><code>PATCH /api/admin/users/2/status</code></li>
        </ul>
      </section>
    </main>
  </body>
</html>`;
  }
};
