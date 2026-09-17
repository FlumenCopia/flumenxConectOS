import { Router } from 'express';
import { AuditLogController } from '../controllers/auditLogController';
import { requireAuth } from '../middleware/authMiddleware';
import { requirePermission } from '../middleware/permissionMiddleware';

const router = Router();

// Base protection: require active user session and clients.view_audit_logs permission
router.use(requireAuth);
router.use(requirePermission('clients.view_audit_logs'));

router.get('/', AuditLogController.listAuditLogs);

export default router;
