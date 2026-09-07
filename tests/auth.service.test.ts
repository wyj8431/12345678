import { describe, expect, it } from "vitest";
import { authLoginSchema } from "../src/schemas/auth.schema.js";
import { authService } from "../src/services/auth.service.js";
import { verifyJwt } from "../src/utils/jwt.js";
import { createPasswordHash, verifyPassword } from "../src/utils/password.js";

describe("auth", () => {
  it("logs in the mock admin and returns a bearer token", async () => {
    const result = await authService.login({
      username: "admin",
      password: "admin123456"
    });

    expect(result.tokenType).toBe("Bearer");
    expect(result.accessToken.split(".")).toHaveLength(3);
    expect(result.user).toMatchObject({
      id: 1,
      username: "admin",
      role: "admin",
      status: "active",
      permissions: expect.arrayContaining(["admin:read", "admin:dashboard:read"])
    });

    const payload = verifyJwt(result.accessToken);
    expect(payload.sub).toBe("1");
    expect(payload.role).toBe("admin");
  });

  it("rejects invalid mock credentials without exposing credential details", async () => {
    await expect(
      authService.login({
        username: "admin",
        password: "wrong-pass"
      })
    ).rejects.toMatchObject({
      code: "AUTH_401",
      message: "Invalid username or password"
    });
  });

  it("returns the current mock user without credential fields", async () => {
    const result = await authService.getCurrentUser({
      userId: 1,
      role: "admin"
    });

    expect(result.user).toEqual({
      id: 1,
      username: "admin",
      role: "admin",
      status: "active",
      permissions: expect.arrayContaining(["admin:read", "admin:dashboard:read"])
    });
    expect(result.user).not.toHaveProperty("passwordHash");
  });

  it("validates login input shape", () => {
    expect(() => authLoginSchema.parse({ username: "", password: "short" })).toThrow();
  });

  it("rejects tampered JWT tokens", async () => {
    const result = await authService.login({
      username: "admin",
      password: "admin123456"
    });
    const [header, payload] = result.accessToken.split(".");

    expect(() => verifyJwt(`${header}.${payload}.tampered`)).toThrow();
  });

  it("creates and verifies scrypt password hashes", () => {
    const hash = createPasswordHash("admin123456", "fixed-test-salt");

    expect(hash.startsWith("scrypt$fixed-test-salt$")).toBe(true);
    expect(verifyPassword("admin123456", hash)).toBe(true);
    expect(verifyPassword("wrong-pass", hash)).toBe(false);
  });
});
