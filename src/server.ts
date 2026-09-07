import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { mysqlPool } from "./providers/mysql.provider.js";
import { logger } from "./utils/logger.js";

const app = createApp();

const server = app.listen(env.PORT, () => {
  logger.info({ port: env.PORT }, "zhishu-ai-api started");
});

let isShuttingDown = false;

async function shutdown(signal: NodeJS.Signals) {
  if (isShuttingDown) {
    logger.warn({ signal }, "shutdown already in progress");
    return;
  }

  isShuttingDown = true;
  logger.info({ signal }, "zhishu-ai-api shutting down");

  const forceExitTimer = setTimeout(() => {
    logger.error({ signal }, "forced shutdown after timeout");
    process.exit(1);
  }, 10_000);
  forceExitTimer.unref();

  try {
    server.closeIdleConnections();

    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });

    await mysqlPool.end();

    clearTimeout(forceExitTimer);
    logger.info({ signal }, "zhishu-ai-api shutdown complete");
    process.exit(0);
  } catch (error) {
    clearTimeout(forceExitTimer);
    logger.error({ error, signal }, "zhishu-ai-api shutdown failed");
    process.exit(1);
  }
}

process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);
