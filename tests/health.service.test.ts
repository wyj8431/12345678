import { describe, expect, it } from "vitest";
import { healthService } from "../src/services/health.service.js";

describe("healthService", () => {
  it("returns ready in mock mode without checking MySQL", async () => {
    const readiness = await healthService.getReadiness();

    expect(readiness).toEqual({
      status: "ready",
      checks: {
        app: "ok",
        mysql: "skipped",
        vector: "skipped"
      }
    });
  });
});
