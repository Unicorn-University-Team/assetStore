import { requireAuth } from '@assetstore/shared';
import { Router } from 'express';
import { loadPublicKey } from '../auth/jwt';
import { TagController } from '../controllers/tag.controller';

export const tagRoutes = Router();

tagRoutes.get('/', TagController.list);
tagRoutes.post('/', requireAuth(loadPublicKey), TagController.create);
