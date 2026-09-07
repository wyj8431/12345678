import { describe, expect, it } from "vitest";
import { authLoginSchema } from "../src/schemas/auth.schema.js";
import { chatStreamRequestSchema } from "../src/schemas/chat.schema.js";
import { fileInitSchema } from "../src/schemas/file.schema.js";

describe("schemas", () => {
  it("accepts a valid chat stream request", () => {
    const result = chatStreamRequestSchema.parse({
      content: "智枢AI是什么？",
      inputType: "text"
    });

    expect(result.inputType).toBe("text");
  });

  it("rejects oversized chat content", () => {
    expect(() =>
      chatStreamRequestSchema.parse({
        content: "x".repeat(8001),
        inputType: "text"
      })
    ).toThrow();
  });

  it("accepts file upload init payload", () => {
    const result = fileInitSchema.parse({
      fileName: "demo.txt",
      fileSize: 1024,
      fileType: "txt",
      checksum: "abc123456"
    });

    expect(result.ingestMode).toBe("permanent");
  });

  it("accepts an auth login payload", () => {
    const result = authLoginSchema.parse({
      username: "admin",
      password: "admin123456"
    });

    expect(result.username).toBe("admin");
  });
});
