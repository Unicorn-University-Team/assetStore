import { Request, Response, NextFunction } from "express";

export function requireRole(allowedRole: "USER" | "ADMIN") {
  return function (_req: Request, res: Response, next: NextFunction) {
    const role = res.locals.role;
    if (role !== allowedRole) {
      return res.status(403).json({ error: "Forbidden" });
    }

    next();
  };
}
