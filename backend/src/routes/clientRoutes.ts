import { Router } from 'express';
import { ClientController } from '../controllers/clientController';
import { requireAuth } from '../middleware/authMiddleware';
import { requirePermission } from '../middleware/permissionMiddleware';
import { validate } from '../middleware/validate';
import {
  createClientSchema,
  updateClientSchema,
  updateClientStatusSchema,
  updateClientHealthSchema,
  assignManagersSchema,
  updateOnboardingItemSchema,
} from '../validators/clientValidators';
import clientUserRoutes from './clientUserRoutes';

const router = Router();

// Base protection: require active user session
router.use(requireAuth);

// Client directory and query
router.get('/', requirePermission('clients.view'), ClientController.listClients);
router.post('/', requirePermission('clients.create'), validate(createClientSchema), ClientController.createClient);

// Nested user management routes: /api/v1/admin/clients/:clientId/users
router.use('/:clientId/users', clientUserRoutes);

// Single client operations
router.get('/:clientId', requirePermission('clients.view'), ClientController.getClient);
router.put('/:clientId', requirePermission('clients.update'), validate(updateClientSchema), ClientController.updateClient);
router.patch('/:clientId/status', requirePermission('clients.update'), validate(updateClientStatusSchema), ClientController.updateStatus);
router.patch('/:clientId/health', requirePermission('clients.update'), validate(updateClientHealthSchema), ClientController.updateHealth);
router.patch('/:clientId/managers', requirePermission('clients.assign_managers'), validate(assignManagersSchema), ClientController.updateManagers);
router.delete('/:clientId', requirePermission('clients.archive'), ClientController.archiveClient);

// Onboarding and activity
router.get('/:clientId/onboarding', requirePermission('clients.view'), ClientController.getOnboarding);
router.patch('/:clientId/onboarding/:itemId', requirePermission('clients.update'), validate(updateOnboardingItemSchema), ClientController.updateOnboardingItem);
router.get('/:clientId/activity', requirePermission('clients.view'), ClientController.getActivity);

export default router;
