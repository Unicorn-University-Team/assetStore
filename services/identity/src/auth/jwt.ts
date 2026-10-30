import { importPKCS8, importSPKI, SignJWT } from "jose";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { jwtVerify } from "jose";

export async function loadPrivateKey() {
  const privateKeyPath = resolve(process.cwd(), "keys/private.pem");
  const privateKeyPem = await readFile(privateKeyPath, "utf8");
  const privateKey = await importPKCS8(privateKeyPem, "RS256");

  return privateKey;
}

export async function signAccessToken(userId: number, role: "USER" | "ADMIN") {
  const token = await new SignJWT({ role })
    .setProtectedHeader({
      alg: "RS256",
    })
    .setSubject(String(userId))
    .setIssuedAt() // автоматически ставит актуальное время
    .setExpirationTime("15m")
    .sign(await loadPrivateKey());

  return token;
}

export async function loadPublicKey() {
  const publicKeyUrl = resolve(process.cwd(), "keys/public.pem");
  const publicKeyPem = await readFile(publicKeyUrl, "utf8");
  const publicKey = await importSPKI(publicKeyPem, "RS256");

  return publicKey;
}

//проверка цифровой подписи,срок действия, но не гарантия, что внутри JWT все правильно
export async function verifyAccessToken(token: string) {
  const result = await jwtVerify(token, await loadPublicKey(), {
    algorithms: ["RS256"],
  });

  return result.payload;
}
