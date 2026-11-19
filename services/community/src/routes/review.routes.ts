import { requireAuth } from "@assetstore/shared";
import { Router } from "express";
import { loadPublicKey } from "../auth/jwt";
import { ReviewController } from "../controllers/review.controller";

export const assetReviewRoutes = Router({mergeParams: true});

assetReviewRoutes.post("/", requireAuth(loadPublicKey), ReviewController.create)