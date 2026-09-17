import { Router } from 'express';
import { ClientSettingsController } from '../controllers/clientSettingsController';
import { requireAuth } from '../middleware/authMiddleware';
import { requireClientAccess } from '../middleware/clientAccessMiddleware';
import { requirePermission } from '../middleware/permissionMiddleware';
import { validate } from '../middleware/validate';
import {
  updateClientSettingsSchema,
  inviteClientUserSchema,
  switchWorkspaceSchema,
} from '../validators/clientValidators';

const router = Router();

// Base protection: require active user session
router.use(requireAuth);

// Workspace switching endpoint (validates that user has active membership in target client)
router.post('/switch', validate(switchWorkspaceSchema), ClientSettingsController.switchWorkspace);

// Current workspace details (scoped strictly by resolved client workspace)
router.get('/current', requireClientAccess, ClientSettingsController.getCurrentWorkspace);

// Workspace settings updates (restricted to client admin with clients.manage_settings)
router.put(
  '/settings',
  requireClientAccess,
  requirePermission('clients.manage_settings'),
  validate(updateClientSettingsSchema),
  ClientSettingsController.updateWorkspaceSettings
);

// Workspace team management
router.get(
  '/team',
  requireClientAccess,
  requirePermission('clients.manage_users'),
  ClientSettingsController.getWorkspaceTeam
);

router.post(
  '/team/invite',
  requireClientAccess,
  requirePermission('clients.manage_users'),
  validate(inviteClientUserSchema),
  ClientSettingsController.inviteWorkspaceTeamMember
);

export default router;
