import { Router } from 'express';
import {
  listForms,
  getForm,
  createForm,
  updateForm,
  duplicateForm,
  updateFormStatus,
  archiveForm,
  getEmbedConfig,
  listSubmissions,
  getSubmission,
  reprocessSubmission,
} from '../controllers/formController';
import {
  listFields,
  createField,
  updateField,
  deleteField,
  reorderFields,
} from '../controllers/formFieldController';
import { requireAuth } from '../middleware/authMiddleware';
import { requirePermission } from '../middleware/permissionMiddleware';
import { validate } from '../middleware/validate';
import {
  createFormSchema,
  updateFormSchema,
  updateFormStatusSchema,
  createFormFieldSchema,
  updateFormFieldSchema,
  reorderFieldsSchema,
} from '../validators/formValidators';

const router = Router();

// =============================================================
// Submissions (Placed before :formId to avoid route collision)
// =============================================================
router.get('/submissions', requireAuth, requirePermission('forms.view_submissions'), listSubmissions);
router.get('/submissions/:submissionId', requireAuth, requirePermission('forms.view_submissions'), getSubmission);
router.post('/submissions/:submissionId/reprocess', requireAuth, requirePermission('forms.manage_submissions'), reprocessSubmission);

// =============================================================
// Form CRUD & Lifecycle
// =============================================================
router.get('/', requireAuth, requirePermission('forms.view'), listForms);
router.post('/', requireAuth, requirePermission('forms.create'), validate(createFormSchema), createForm);
router.get('/:formId', requireAuth, requirePermission('forms.view'), getForm);
router.put('/:formId', requireAuth, requirePermission('forms.edit'), validate(updateFormSchema), updateForm);
router.post('/:formId/duplicate', requireAuth, requirePermission('forms.create'), duplicateForm);
router.patch('/:formId/status', requireAuth, requirePermission('forms.publish'), validate(updateFormStatusSchema), updateFormStatus);
router.delete('/:formId', requireAuth, requirePermission('forms.publish'), archiveForm);
router.get('/:formId/embed', requireAuth, requirePermission('forms.view'), getEmbedConfig);
router.get('/:formId/submissions', requireAuth, requirePermission('forms.view_submissions'), listSubmissions);

// =============================================================
// Field Builder & Ordering
// =============================================================
router.get('/:formId/fields', requireAuth, requirePermission('forms.view'), listFields);
router.post('/:formId/fields', requireAuth, requirePermission('forms.edit'), validate(createFormFieldSchema), createField);
router.post('/:formId/fields/reorder', requireAuth, requirePermission('forms.edit'), validate(reorderFieldsSchema), reorderFields);
router.put('/:formId/fields/:fieldId', requireAuth, requirePermission('forms.edit'), validate(updateFormFieldSchema), updateField);
router.delete('/:formId/fields/:fieldId', requireAuth, requirePermission('forms.edit'), deleteField);

export default router;
