import { Router } from 'express';
import { ClientUserController } from '../controllers/clientUserController';
import { requireAuth } from '../middleware/authMiddleware';
import { requirePermission } from '../middleware/permissionMiddleware';
import { validate } from '../middleware/validate';
import {
  inviteClientUserSchema,
  updateUserRoleSchema,
  updateUserStatusSchema,
} from '../validators/clientValidators';

const router = Router({ mergeParams: true });

// Require authentication and clients.manage_users permission
router.use(requireAuth);
router.use(requirePermission('clients.manage_users'));

router.get('/', ClientUserController.listUsers);
router.post('/invite', validate(inviteClientUserSchema), ClientUserController.inviteUser);
router.patch('/:userId/role', validate(updateUserRoleSchema), ClientUserController.updateUserRole);
router.patch('/:userId/status', validate(updateUserStatusSchema), ClientUserController.updateUserStatus);
router.delete('/:userId', ClientUserController.removeUser);

export default router;
