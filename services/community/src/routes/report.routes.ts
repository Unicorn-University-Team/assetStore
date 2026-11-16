import { requireAuth, requireRole } from '@assetstore/shared';
import { Router } from 'express';
import { loadPublicKey } from '../auth/jwt';
import { ReportController } from '../controllers/report.controller';

// /api/assets/:assetId/reports: reporting an asset (any logged-in user).
export const assetReportRoutes = Router({ mergeParams: true });

assetReportRoutes.post('/', requireAuth(loadPublicKey), ReportController.create);

// /api/reports: the admin's list, detail and decision.
export const reportRoutes = Router();

reportRoutes.use(requireAuth(loadPublicKey), requireRole('ADMIN'));
reportRoutes.get('/', ReportController.list);
reportRoutes.get('/:id', ReportController.getById);
reportRoutes.post('/:id/reject', ReportController.reject);
