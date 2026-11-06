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
    try {
      const payload = await verifyAccessToken(token, await loadPublicKey());
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
      if (
        error instanceof errors.JWTExpired ||
        error instanceof errors.JWSSignatureVerificationFailed ||
        error instanceof errors.JWTInvalid ||
        error instanceof errors.JWSInvalid ||
        error instanceof errors.JOSEAlgNotAllowed
      ) {
        return res.status(401).json({ error: "Invalid or expired token." });
      }
      return next(error); //отдает остальные ошибки стандартному обработчику
    }
    next();
  };
}
