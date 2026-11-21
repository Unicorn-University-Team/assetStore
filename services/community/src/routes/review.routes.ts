import { requireAuth } from '@assetstore/shared';
import { Router } from 'express';
import { loadPublicKey } from '../auth/jwt';
import { ReviewController } from '../controllers/review.controller';

// /api/assets/:assetId/reviews: reading the reviews (anybody) and reviewing an asset (any logged-in user except
// its owner).
export const assetReviewRoutes = Router({ mergeParams: true });

assetReviewRoutes.get('/', ReviewController.list);
assetReviewRoutes.post('/', requireAuth(loadPublicKey), ReviewController.create);
