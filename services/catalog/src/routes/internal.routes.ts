import { Router } from 'express';
import { InternalController } from '../controllers/internal.controller';

// Routes for other services only. Caddy does not send /internal from outside, and app.ts puts
// requireInternalKey in front of them.
export const internalRoutes = Router();

internalRoutes.get('/assets/:id/exists', InternalController.assetExists);
