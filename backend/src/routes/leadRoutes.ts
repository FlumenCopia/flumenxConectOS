import { Router } from 'express';
import { LeadController } from '../controllers/leadController';
import { requireAuth } from '../middleware/authMiddleware';
import { requirePermission } from '../middleware/permissionMiddleware';
import { validate } from '../middleware/validate';
import {
  createLeadSchema,
  updateLeadSchema,
  updateLeadStageSchema,
  assignLeadSchema,
  updateLeadScoreSchema,
  addLeadActivitySchema,
} from '../validators/leadValidators';

const router = Router();

// Base protection: require active user session
router.use(requireAuth);

// 1. Pipeline aggregation summary (supports both hyphen and slash conventions)
router.get('/pipeline-summary', requirePermission('leads.view'), LeadController.getPipelineSummary);
router.get('/pipeline/summary', requirePermission('leads.view'), LeadController.getPipelineSummary);

// 2. CSV Export (must be declared before :leadId)
router.get('/export', requirePermission('leads.export'), LeadController.exportLeadsCsv);

// 3. Lead list & creation
router.get('/', requirePermission('leads.view'), LeadController.getLeads);
router.post('/', requirePermission('leads.create'), validate(createLeadSchema), LeadController.createLead);

// 4. Lead detail, update, and soft archive
router.get('/:leadId', requirePermission('leads.view'), LeadController.getLeadById);
router.put('/:leadId', requirePermission('leads.update'), validate(updateLeadSchema), LeadController.updateLead);
router.delete('/:leadId', requirePermission('leads.delete'), LeadController.deleteLead);

// 5. Stage, Assign, Score mutations
router.patch(
  '/:leadId/stage',
  requirePermission('leads.update'),
  validate(updateLeadStageSchema),
  LeadController.updateStage
);
router.patch(
  '/:leadId/assign',
  requirePermission('leads.assign'),
  validate(assignLeadSchema),
  LeadController.assignLead
);
router.patch(
  '/:leadId/score',
  requirePermission('leads.update'),
  validate(updateLeadScoreSchema),
  LeadController.updateScore
);

// 6. Lead Activity Timeline & Manual Notes
router.get('/:leadId/activity', requirePermission('leads.view_activity'), LeadController.getLeadActivity);
router.post(
  '/:leadId/activity',
  requirePermission('leads.update'),
  validate(addLeadActivitySchema),
  LeadController.addLeadActivity
);

export default router;
