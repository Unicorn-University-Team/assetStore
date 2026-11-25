import { Router } from "express";
import { requireAuth, requireRole } from "@assetstore/shared";
import { loadPublicKey } from "../auth/jwt";
import { UserController } from "../controllers/user.controller";

// AM user/list and user/get (US-8): admins only (Authorities). user/delete follows with US-8.
export const userRoutes = Router();

userRoutes.use(requireAuth(loadPublicKey), requireRole("ADMIN"));
userRoutes.get("/", UserController.list);
userRoutes.get("/:id", UserController.get);
