import crypto from "node:crypto";

const KEY_LENGTH = 64;

function safeEqualHex(left: string, right: string) {
  const leftBuffer = Buffer.from(left, "hex");
  const rightBuffer = Buffer.from(right, "hex");
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

export function createPasswordHash(password: string, salt = crypto.randomBytes(16).toString("hex")) {
  const hash = crypto.scryptSync(password, salt, KEY_LENGTH).toString("hex");
  return `scrypt$${salt}$${hash}`;
}

export function verifyPassword(password: string, storedHash: string) {
  const [algorithm, salt, hash] = storedHash.split("$");
  if (!algorithm || !salt || !hash) return false;

  if (algorithm === "scrypt") {
    const candidate = crypto.scryptSync(password, salt, KEY_LENGTH).toString("hex");
    return safeEqualHex(candidate, hash);
  }

  if (algorithm === "sha256") {
    const candidate = crypto.createHash("sha256").update(`${salt}:${password}`).digest("hex");
    return safeEqualHex(candidate, hash);
  }

  return false;
}
