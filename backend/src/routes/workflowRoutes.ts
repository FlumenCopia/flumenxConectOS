import { Router } from 'express';
import { WorkflowController } from '../controllers/workflowController';
import { requireAuth } from '../middleware/authMiddleware';
import { requirePermission } from '../middleware/permissionMiddleware';
import { validate } from '../middleware/validate';
import {
  createWorkflowSchema,
  updateWorkflowSchema,
  updateWorkflowStatusSchema,
  testWorkflowConditionsSchema,
  executeManualWorkflowSchema,
} from '../validators/workflowValidators';

const router = Router();

// Base protection: require active user session
router.use(requireAuth);

// 1. Runs endpoints (declared before :id parameter routes)
router.get('/runs', requirePermission('workflows.view_runs'), WorkflowController.listRuns);
router.get('/runs/:runId', requirePermission('workflows.view_runs'), WorkflowController.getRun);

// 2. Workflow Collection & CRUD
router.get('/', requirePermission('workflows.view'), WorkflowController.listWorkflows);
router.post(
  '/',
  requirePermission('workflows.create'),
  validate(createWorkflowSchema),
  WorkflowController.createWorkflow
);

// 3. Specific Workflow Operations
router.get('/:id', requirePermission('workflows.view'), WorkflowController.getWorkflow);
router.get('/:id/runs', requirePermission('workflows.view_runs'), WorkflowController.listRuns);
router.put(
  '/:id',
  requirePermission('workflows.edit'),
  validate(updateWorkflowSchema),
  WorkflowController.updateWorkflow
);
router.patch(
  '/:id/status',
  requirePermission('workflows.enable'),
  validate(updateWorkflowStatusSchema),
  WorkflowController.updateStatus
);
router.delete('/:id', requirePermission('workflows.delete'), WorkflowController.deleteWorkflow);

// 4. Testing & Manual Execution
router.post(
  '/:id/test-conditions',
  requirePermission('workflows.execute'),
  validate(testWorkflowConditionsSchema),
  WorkflowController.testConditions
);
router.post(
  '/:id/execute',
  requirePermission('workflows.execute'),
  validate(executeManualWorkflowSchema),
  WorkflowController.executeWorkflow
);

export default router;
