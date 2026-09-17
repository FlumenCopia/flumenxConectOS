import { Router } from 'express';
import { NotificationController } from '../controllers/notificationController';
import { requireAuth } from '../middleware/authMiddleware';
import { requirePermission } from '../middleware/permissionMiddleware';

const router = Router();

// Base protection: require active user session
router.use(requireAuth);

// 1. Reading & Counting (requires notifications.view)
router.get('/', requirePermission('notifications.view'), NotificationController.listNotifications);
router.get('/unread-count', requirePermission('notifications.view'), NotificationController.getUnreadCount);

// 2. Modifying state (requires notifications.manage)
router.patch('/:id/read', requirePermission('notifications.manage'), NotificationController.markAsRead);
router.post('/mark-all-read', requirePermission('notifications.manage'), NotificationController.markAllAsRead);

export default router;
