import { HttpError } from "@assetstore/shared";
import { importPKCS8, importSPKI, SignJWT } from "jose";
import { env } from "../config/env";

// Keys come from env (base64 of the PEM files) and are imported once, on first use.
type Key = Awaited<ReturnType<typeof importPKCS8>>;
let privateKey: Promise<Key> | undefined;
let publicKey: Promise<Key> | undefined;

function decodePem(base64: string, name: string): string {
  if (!base64) {
    throw new HttpError(503, `Login is not available: ${name} is not set.`);
  }
  return Buffer.from(base64, "base64").toString("utf8");
}

export function loadPrivateKey() {
  privateKey ??= importPKCS8(
    decodePem(env.jwtPrivateKey, "JWT_PRIVATE_KEY"),
    "RS256",
  );
  return privateKey;
}

export function loadPublicKey() {
  publicKey ??= importSPKI(
    decodePem(env.jwtPublicKey, "JWT_PUBLIC_KEY"),
    "RS256",
  );
  return publicKey;
}

export async function signAccessToken(
  userId: string,
  role: "USER" | "ADMIN",
  sessionExpiresAt: Date,
) {
  const remainingTime = sessionExpiresAt.getTime() - Date.now();
  const accessTokenLifeTime = 15 * 60 * 1000;
  if (remainingTime <= 0) {
    throw new Error("Session has expired.");
  }
  const accessTokenExpiresAt = new Date(
    Date.now() + Math.min(accessTokenLifeTime, remainingTime),
  );

  const token = await new SignJWT({ role })
    .setProtectedHeader({
      alg: "RS256",
    })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(accessTokenExpiresAt)
    .sign(await loadPrivateKey());

  return token;
}
