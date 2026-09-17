import { Router } from 'express';
import { AdminUserController } from '../controllers/adminUserController';
import { requireAuth, requireSuperAdmin } from '../middleware/authMiddleware';

const router = Router();

// Base protection: require active authenticated user
router.use(requireAuth);

// All authenticated staff/admins can list staff and account managers for dropdowns
router.get('/', AdminUserController.listStaffUsers);
router.get('/managers', AdminUserController.listAccountManagers);

// Super Admin only can invite new staff or toggle staff status
router.post('/invite', requireSuperAdmin, AdminUserController.inviteStaffUser);
router.patch('/:userId/status', requireSuperAdmin, AdminUserController.updateStaffStatus);

export default router;
