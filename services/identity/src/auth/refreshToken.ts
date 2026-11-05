import { randomBytes, createHash } from "node:crypto";

export function generateRefreshToken(): string {
  const token = randomBytes(32).toString("hex");
  return token;
}

export function hashRefreshToken(token: string): string {
  const refreshTokenHash = createHash("sha256").update(token).digest("hex");
  return refreshTokenHash;
}
