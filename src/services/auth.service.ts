import { env } from "../config/env.js";
import { authRepository } from "../repositories/auth.repository.js";
import type { AuthLoginRequest, AuthLoginResponse, AuthMeResponse, AuthUser } from "../schemas/auth.schema.js";
import { AppError } from "../utils/errors.js";
import { signJwt } from "../utils/jwt.js";
import { verifyPassword } from "../utils/password.js";
import { getPermissionsForRole } from "../utils/rbac.js";

function signLoginResponse(user: AuthUser): AuthLoginResponse {
  const { token, expiresAt } = signJwt({ userId: user.id, role: user.role });
  return {
    accessToken: token,
    tokenType: "Bearer",
    expiresAt,
    user
  };
}

export const authService = {
  async login(input: AuthLoginRequest): Promise<AuthLoginResponse> {
    if (env.USE_MOCK_DB) {
      if (input.username !== env.MOCK_ADMIN_USERNAME || input.password !== env.MOCK_ADMIN_PASSWORD) {
        throw new AppError("AUTH_401", "Invalid username or password", 401);
      }

      return signLoginResponse({
        id: env.DEFAULT_USER_ID,
        username: env.MOCK_ADMIN_USERNAME,
        role: env.DEFAULT_USER_ROLE,
        status: "active",
        permissions: getPermissionsForRole(env.DEFAULT_USER_ROLE)
      });
    }

    const user = await authRepository.findUserByUsername(input.username);
    if (!user || !verifyPassword(input.password, user.passwordHash)) {
      throw new AppError("AUTH_401", "Invalid username or password", 401);
    }
    if (user.status !== "active") {
      throw new AppError("AUTH_403", "User account is disabled", 403);
    }

    return signLoginResponse({
      id: user.id,
      username: user.username,
      role: user.role,
      status: user.status,
      permissions: getPermissionsForRole(user.role)
    });
  },

  async getCurrentUser(input: { userId: number; role: AuthUser["role"] }): Promise<AuthMeResponse> {
    if (env.USE_MOCK_DB) {
      return {
        user: {
          id: input.userId,
          username: env.MOCK_ADMIN_USERNAME,
          role: input.role,
          status: "active",
          permissions: getPermissionsForRole(input.role)
        }
      };
    }

    const user = await authRepository.findUserById(input.userId);
    if (!user) {
      throw new AppError("AUTH_401", "Authentication user not found", 401);
    }
    if (user.status !== "active") {
      throw new AppError("AUTH_403", "User account is disabled", 403);
    }

    return {
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        status: user.status,
        permissions: getPermissionsForRole(user.role)
      }
    };
  }
};
