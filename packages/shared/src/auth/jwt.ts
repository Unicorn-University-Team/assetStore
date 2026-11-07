import { importSPKI, jwtVerify } from "jose";

export type PublicKey = Awaited<ReturnType<typeof importSPKI>>;

// Digital signature verification
export async function verifyAccessToken(token: string, publicKey: PublicKey) {
  const result = await jwtVerify(token, publicKey, { algorithms: ["RS256"] });

  return result.payload;
}
