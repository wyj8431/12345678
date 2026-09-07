import type { RowDataPacket } from "mysql2/promise";
import { mysqlPool } from "../providers/mysql.provider.js";
import type { AuthUserRole, AuthUserStatus } from "../schemas/auth.schema.js";

export type AuthUserRow = {
  id: number;
  username: string;
  passwordHash: string;
  role: AuthUserRole;
  status: AuthUserStatus;
};

type AuthUserPacket = RowDataPacket & AuthUserRow;

export const authRepository = {
  async findUserByUsername(username: string) {
    const [rows] = await mysqlPool.query<AuthUserPacket[]>(
      `SELECT id, username, password_hash AS passwordHash, role, status
       FROM users
       WHERE username = ?
       LIMIT 1`,
      [username]
    );

    return rows[0] ?? null;
  },

  async findUserById(id: number) {
    const [rows] = await mysqlPool.query<AuthUserPacket[]>(
      `SELECT id, username, password_hash AS passwordHash, role, status
       FROM users
       WHERE id = ?
       LIMIT 1`,
      [id]
    );

    return rows[0] ?? null;
  }
};
