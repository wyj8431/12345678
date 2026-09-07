import { env } from "../config/env.js";
import { mysqlPool } from "../providers/mysql.provider.js";

export type ReadinessResult = {
  status: "ready" | "not_ready";
  checks: {
    app: "ok";
    mysql: "ok" | "skipped" | "failed";
    vector: "ok" | "skipped";
  };
};

export const healthService = {
  async getReadiness(): Promise<ReadinessResult> {
    const checks: ReadinessResult["checks"] = {
      app: "ok",
      mysql: env.USE_MOCK_DB ? "skipped" : "failed",
      vector: env.VECTOR_PROVIDER === "mock" ? "skipped" : "ok"
    };

    if (!env.USE_MOCK_DB) {
      try {
        await mysqlPool.query("SELECT 1");
        checks.mysql = "ok";
      } catch {
        checks.mysql = "failed";
      }
    }

    return {
      status: checks.mysql === "failed" ? "not_ready" : "ready",
      checks
    };
  }
};
