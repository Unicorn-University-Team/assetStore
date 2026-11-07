import type { Request, Response, NextFunction } from "express";
import type { PublicKey } from "./jwt";
import { verifyAccessToken } from "./jwt";
import { errors } from "jose";

export function requireAuth(loadPublicKey: () => Promise<PublicKey>) {
  return async function (req: Request, res: Response, next: NextFunction) {
    const token = req.cookies?.access_token;

    if (!token || typeof token !== "string" || token.length === 0) {
      return res.status(401).json({ error: "Authentication required." });
    }
    // Outside the try: a missing or broken key is a server problem (503 or 500), not a bad token.
    const publicKey = await loadPublicKey();
    try {
      const payload = await verifyAccessToken(token, publicKey);
      const userId = payload.sub;

      if (
        typeof userId !== "string" ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
          userId,
        )
      ) {
        return res.status(401).json({
          error: "Invalid token.",
        });
      }
      const role = payload.role;

      if (role !== "USER" && role !== "ADMIN") {
        return res.status(401).json({
          error: "Invalid token role.",
        });
      }
      res.locals.userId = userId;
      res.locals.role = role;
    } catch (error) {
      // Any jose error means the token itself is bad (expired, wrong signature, malformed, unsupported header...).
      if (error instanceof errors.JOSEError) {
        return res.status(401).json({ error: "Invalid or expired token." });
      }
      return next(error); //отдает остальные ошибки стандартному обработчику
    }
    next();
  };
}
