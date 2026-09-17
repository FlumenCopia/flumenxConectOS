import { Router } from 'express';
import {
  getConversations,
  getConversation,
  createConversation,
  updateStatus,
  updatePriority,
  assignConversation,
  updateTags,
  markAsRead,
  archiveConversation,
  reopenConversation,
  getMessages,
  sendMessage,
  retryMessage,
  getActivities,
  getCommunicationProviders,
  saveCommunicationProvider,
  deleteCommunicationProvider,
  testCommunicationProvider,
} from '../controllers/conversationController';
import { requireAuth } from '../middleware/authMiddleware';
import { requirePermission } from '../middleware/permissionMiddleware';
import { validate } from '../middleware/validate';
import {
  createConversationSchema,
  sendMessageSchema,
  updateStatusSchema,
  updatePrioritySchema,
  assignConversationSchema,
  updateTagsSchema,
  createProviderSchema,
  testProviderSchema,
} from '../validators/conversationValidators';

const router = Router();

// Base protection: require active user session
router.use(requireAuth);

router.get('/', requirePermission('conversations.view'), getConversations);
router.post('/', requirePermission('conversations.create'), validate(createConversationSchema), createConversation);

// Channel Communication Provider Management
router.get('/providers', requirePermission('conversations.view'), getCommunicationProviders);
router.post(
  '/providers',
  requirePermission('conversations.manage_status'),
  validate(createProviderSchema),
  saveCommunicationProvider
);
router.delete(
  '/providers/:providerId',
  requirePermission('conversations.manage_status'),
  deleteCommunicationProvider
);
router.post(
  '/providers/test',
  requirePermission('conversations.manage_status'),
  validate(testProviderSchema),
  testCommunicationProvider
);

router.get('/:conversationId', requirePermission('conversations.view'), getConversation);
router.patch(
  '/:conversationId/status',
  requirePermission('conversations.manage_status'),
  validate(updateStatusSchema),
  updateStatus
);
router.patch(
  '/:conversationId/priority',
  requirePermission('conversations.manage_status'),
  validate(updatePrioritySchema),
  updatePriority
);
router.patch(
  '/:conversationId/assign',
  requirePermission('conversations.assign'),
  validate(assignConversationSchema),
  assignConversation
);
router.patch(
  '/:conversationId/tags',
  requirePermission('conversations.manage_status'),
  validate(updateTagsSchema),
  updateTags
);
router.post('/:conversationId/read', requirePermission('conversations.view'), markAsRead);
router.delete('/:conversationId', requirePermission('conversations.manage_status'), archiveConversation);
router.post('/:conversationId/reopen', requirePermission('conversations.manage_status'), reopenConversation);

// Message routes
router.get('/:conversationId/messages', requirePermission('conversations.view'), getMessages);
router.post(
  '/:conversationId/messages',
  requirePermission('conversations.reply'),
  validate(sendMessageSchema),
  sendMessage
);
router.post(
  '/:conversationId/messages/:messageId/retry',
  requirePermission('conversations.reply'),
  retryMessage
);

// Activities route
router.get('/:conversationId/activities', requirePermission('conversations.view_audit'), getActivities);

export default router;
