import { requireAuth } from '@assetstore/shared';
import { Router } from 'express';
import { loadPublicKey } from '../auth/jwt';
import { CollectionController } from '../controllers/collection.controller';

// /api/collections: the logged-in user's own collections.
export const collectionRoutes = Router();

collectionRoutes.use(requireAuth(loadPublicKey));
collectionRoutes.post('/', CollectionController.create);
collectionRoutes.get('/', CollectionController.listMy);
