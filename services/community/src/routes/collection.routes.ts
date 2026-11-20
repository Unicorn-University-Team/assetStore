import { Router } from 'express';
import { loadPublicKey } from '../auth/jwt';
import { requireAuth } from '@assetstore/shared';
import {CollectionController} from "../controllers/collection.controller"

export const collectionRouter = Router();

collectionRouter.post("/", requireAuth(loadPublicKey), CollectionController.create)
collectionRouter.get("/", requireAuth(loadPublicKey), CollectionController.listByOwner)
