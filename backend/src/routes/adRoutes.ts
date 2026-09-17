import { Router } from 'express';
import { AdController } from '../controllers/adController';
import { requireAuth } from '../middleware/authMiddleware';
import { requirePermission } from '../middleware/permissionMiddleware';
import { validate } from '../middleware/validate';
import {
  createConnectionSchema,
  updateConnectionStatusSchema,
} from '../validators/adValidators';

const router = Router();

// Base protection: require active user session
router.use(requireAuth);

// 1. Connection Management
router.get(
  '/connections',
  requirePermission('ads.view'),
  AdController.getConnections
);

router.post(
  '/connections',
  requirePermission('ads.manage_connections'),
  validate(createConnectionSchema),
  AdController.createConnection
);

router.put(
  '/connections/:id/status',
  requirePermission('ads.manage_connections'),
  validate(updateConnectionStatusSchema),
  AdController.updateConnectionStatus
);

router.delete(
  '/connections/:id',
  requirePermission('ads.manage_connections'),
  AdController.revokeConnection
);

// 2. Sync Triggers
router.post(
  '/connections/:id/sync',
  requirePermission('ads.sync'),
  AdController.syncConnection
);

router.post(
  '/sync-all',
  requirePermission('ads.sync'),
  AdController.syncAll
);

// 3. Reporting & Performance Analytics
router.get(
  '/reporting/summary',
  requirePermission('ads.view_reporting'),
  AdController.getReportingSummary
);

router.get(
  '/reporting/timeseries',
  requirePermission('ads.view_reporting'),
  AdController.getTimeSeries
);

// 4. Advertising Hierarchy Entities
router.get(
  '/campaigns',
  requirePermission('ads.view'),
  AdController.getCampaigns
);

router.get(
  '/ad-sets',
  requirePermission('ads.view'),
  AdController.getAdSets
);

router.get(
  '/ad-creatives',
  requirePermission('ads.view'),
  AdController.getAdCreatives
);

// 5. Multi-Touch Lead Attributions
router.get(
  '/attributions',
  requirePermission('ads.view_attribution'),
  AdController.getAttributions
);

router.get(
  '/attributions/summary',
  requirePermission('ads.view_attribution'),
  AdController.getAttributionSummary
);

export default router;
