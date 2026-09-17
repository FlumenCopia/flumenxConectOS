import { Router } from 'express';
import {
  getContacts,
  getContact,
  createContact,
  updateContact,
} from '../controllers/contactController';
import { requireAuth } from '../middleware/authMiddleware';
import { requirePermission } from '../middleware/permissionMiddleware';
import { validate } from '../middleware/validate';
import { createContactSchema, updateContactSchema } from '../validators/conversationValidators';

const router = Router();

router.use(requireAuth);

router.get('/', requirePermission('contacts.view'), getContacts);
router.post('/', requirePermission('contacts.manage'), validate(createContactSchema), createContact);
router.get('/:contactId', requirePermission('contacts.view'), getContact);
router.put('/:contactId', requirePermission('contacts.manage'), validate(updateContactSchema), updateContact);

export default router;
