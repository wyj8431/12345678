import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3001),
  LOG_LEVEL: z.string().default("info"),
  USE_MOCK_DB: z
    .string()
    .transform((value) => value === "true")
    .default("true"),
  MYSQL_HOST: z.string().default("127.0.0.1"),
  MYSQL_PORT: z.coerce.number().int().positive().default(3306),
  MYSQL_USER: z.string().default("root"),
  MYSQL_PASSWORD: z.string().default(""),
  MYSQL_DATABASE: z.string().default("zhishu_ai"),
  VECTOR_PROVIDER: z.enum(["mock", "chroma"]).default("mock"),
  EMBEDDING_PROVIDER: z.enum(["mock"]).default("mock"),
  EMBEDDING_DIMENSION: z.coerce.number().int().positive().default(8),
  CHROMA_BASE_URL: z.string().url().default("http://127.0.0.1:8000"),
  CHROMA_TENANT: z.string().default("default_tenant"),
  CHROMA_DATABASE: z.string().default("default_database"),
  CHROMA_COLLECTION_ID: z.string().default("zhishu_chunks"),
  CHROMA_TOKEN: z.string().default(""),
  RAG_TOP_K: z.coerce.number().int().positive().default(8),
  RAG_SCORE_THRESHOLD: z.coerce.number().min(0).max(1).default(0.75),
  SSE_TIMEOUT_MS: z.coerce.number().int().positive().default(60000),
  DEFAULT_USER_ID: z.coerce.number().int().positive().default(1),
  DEFAULT_USER_ROLE: z.enum(["user", "admin"]).default("admin"),
  AUTH_JWT_SECRET: z.string().min(16).default("dev-secret-change-me"),
  AUTH_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().default(86400),
  MOCK_ADMIN_USERNAME: z.string().min(1).max(64).default("admin"),
  MOCK_ADMIN_PASSWORD: z.string().min(8).max(128).default("admin123456")
});

export const env = envSchema.parse(process.env);
