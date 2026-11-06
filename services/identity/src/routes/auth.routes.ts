import { Router } from "express";
import { AuthController } from "../controllers/auth.controller";
import { requireAuth } from "@assetstore/shared";
import { loadPublicKey } from "../auth/jwt";

export const router = Router();

router.post("/register", AuthController.register);
router.post("/login", AuthController.login);
router.get("/me", requireAuth(loadPublicKey), AuthController.me);
router.post("/refresh", AuthController.refresh);
router.post("/logout", AuthController.logout);
