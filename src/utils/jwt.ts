import crypto from "node:crypto";
import { env } from "../config/env.js";
import { AppError } from "./errors.js";

export type JwtRole = "user" | "admin";

export type JwtPayload = {
  sub: string;
  role: JwtRole;
  iat: number;
  exp: number;
};

function base64UrlEncode(input: Buffer | string) {
  return Buffer.from(input).toString("base64url");
}

function base64UrlJson(input: unknown) {
  return base64UrlEncode(JSON.stringify(input));
}

function signSegments(header: string, payload: string) {
  return crypto.createHmac("sha256", env.AUTH_JWT_SECRET).update(`${header}.${payload}`).digest("base64url");
}

export function signJwt(input: { userId: number; role: JwtRole; ttlSeconds?: number }) {
  const issuedAt = Math.floor(Date.now() / 1000);
  const expiresAtSeconds = issuedAt + (input.ttlSeconds ?? env.AUTH_TOKEN_TTL_SECONDS);
  const header = base64UrlJson({ alg: "HS256", typ: "JWT" });
  const payload = base64UrlJson({
    sub: String(input.userId),
    role: input.role,
    iat: issuedAt,
    exp: expiresAtSeconds
  } satisfies JwtPayload);
  const signature = signSegments(header, payload);

  return {
    token: `${header}.${payload}.${signature}`,
    expiresAt: new Date(expiresAtSeconds * 1000).toISOString()
  };
}

export function verifyJwt(token: string): JwtPayload {
  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new AppError("AUTH_401", "Invalid authentication token", 401);
  }

  const [header, payload, signature] = parts;
  const expected = signSegments(header, payload);
  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(signature);

  if (expectedBuffer.length !== actualBuffer.length || !crypto.timingSafeEqual(expectedBuffer, actualBuffer)) {
    throw new AppError("AUTH_401", "Invalid authentication token", 401);
  }

  let decoded: JwtPayload;
  try {
    decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as JwtPayload;
  } catch {
    throw new AppError("AUTH_401", "Invalid authentication token", 401);
  }

  const now = Math.floor(Date.now() / 1000);
  const userId = Number(decoded.sub);
  if (!Number.isInteger(userId) || userId <= 0 || (decoded.role !== "user" && decoded.role !== "admin")) {
    throw new AppError("AUTH_401", "Invalid authentication token", 401);
  }
  if (!Number.isInteger(decoded.exp) || decoded.exp <= now) {
    throw new AppError("AUTH_401", "Authentication token expired", 401);
  }

  return decoded;
}
