import { Router } from "express";
import { InternalController } from "../controllers/internal.controller";

// Routes for other services only. Caddy does not send /internal from outside, and app.ts puts
// requireInternalKey in front of them.
export const internalRoutes = Router();

internalRoutes.get("/users", InternalController.usernames);
internalRoutes.post("/users/:id/violations", InternalController.addViolation);
internalRoutes.post("/users/:id/violations/:reportId/remove", InternalController.removeViolation);
