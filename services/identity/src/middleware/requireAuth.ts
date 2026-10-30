import type { Request, Response, NextFunction } from "express";
import { verifyAccessToken } from "../auth/jwt";
import { errors } from "jose";

//проверка того, что внутри JWT все правильно
export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const token = req.cookies?.access_token;

  if (!token || typeof token !== "string" || token.length === 0) {
    return res.status(401).json({ error: "Authentication required." });
  }

  try {
    const payload = await verifyAccessToken(token);
    const userId = Number(payload.sub);

    if (!(Number.isSafeInteger(userId) && userId > 0)) {
      return res.status(401).json({ error: "Authorization required." });
    }

    res.locals.userId = userId;
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
}
