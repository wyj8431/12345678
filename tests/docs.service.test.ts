import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { docsService } from "../src/services/docs.service.js";

describe("docsService", () => {
  it("loads the OpenAPI spec from docs/openapi", async () => {
    const spec = await docsService.getOpenApiSpec();

    expect(spec).toMatchObject({
      openapi: "3.1.0",
      info: {
        title: "Zhishu AI API"
      }
    });
    expect((spec as { paths: Record<string, unknown> }).paths["/api/admin/users/{id}/status"]).toBeDefined();
    expect(
      (spec as { components: { schemas: { AuthPermission: { enum: string[] } } } }).components.schemas.AuthPermission.enum
    ).toContain("admin:users:write");
    expect(
      JSON.stringify((spec as { components: { schemas: { AuditLogDetailResponse: unknown } } }).components.schemas.AuditLogDetailResponse)
    ).toContain("targetUser");
  });

  it("renders a docs HTML entry page", () => {
    const html = docsService.getDocsHtml();

    expect(html).toContain("Zhishu AI API Docs");
    expect(html).toContain("/openapi.json");
    expect(html).toContain("PATCH /api/admin/users/2/status");
  });

  it("keeps the Postman collection synced with admin user status updates", async () => {
    const rawCollection = await readFile("docs/postman/zhishu-ai-api.postman_collection.json", "utf8");
    const collection = JSON.parse(rawCollection) as { variable: Array<{ key: string }>; item: unknown[] };
    const serialized = JSON.stringify(collection);

    expect(collection.variable.some((item) => item.key === "targetUserId")).toBe(true);
    expect(serialized).toContain("PATCH /api/admin/users/:id/status");
    expect(serialized).toContain("/api/admin/users/{{targetUserId}}/status");
  });
});
