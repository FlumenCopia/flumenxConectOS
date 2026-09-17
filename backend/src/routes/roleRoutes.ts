import { Router } from 'express';
import { RoleController } from '../controllers/roleController';
import { requireAuth, requireSuperAdmin } from '../middleware/authMiddleware';

const router = Router();

// Base protection: require active authenticated user
router.use(requireAuth);

// All authenticated staff/admins can list roles to populate dropdowns and matrices
router.get('/', RoleController.listRoles);

// Super Admin only can create, edit, and delete roles
router.post('/', requireSuperAdmin, RoleController.createRole);
router.put('/:roleId', requireSuperAdmin, RoleController.updateRole);
router.delete('/:roleId', requireSuperAdmin, RoleController.deleteRole);

export default router;
