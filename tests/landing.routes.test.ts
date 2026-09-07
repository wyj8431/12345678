import type { Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";

describe("landing page", () => {
  let server: Server;
  let origin: string;

  beforeAll(async () => {
    server = createApp().listen(0, "127.0.0.1");
    await new Promise<void>((resolve) => server.once("listening", resolve));

    const address = server.address();
    if (!address || typeof address === "string") {
      throw new Error("Expected the test server to bind to a TCP port");
    }

    origin = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  });

  it("serves the National Day countdown at the root path", async () => {
    const response = await fetch(`${origin}/`);
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/html");
    expect(html).toContain("2026-10-01T00:00:00+08:00");
    expect(html).toContain('data-unit="seconds"');
  });
});
