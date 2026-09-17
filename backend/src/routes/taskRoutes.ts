import { Router } from 'express';
import { TaskController } from '../controllers/taskController';
import { requireAuth } from '../middleware/authMiddleware';
import { requirePermission } from '../middleware/permissionMiddleware';
import { validate } from '../middleware/validate';
import {
  createTaskSchema,
  updateTaskSchema,
  assignTaskSchema,
  updatePrioritySchema,
  updateDueDateSchema,
  snoozeTaskSchema,
  completeTaskSchema,
  applyDispositionSchema,
  slaPolicySchema,
} from '../validators/taskValidators';

const router = Router();

// Base protection: require active user session
router.use(requireAuth);

// 1. Dashboard, Agenda & Aggregations (must be declared before :id)
router.get('/kpis', requirePermission('tasks.view'), TaskController.getTaskKpis);
router.get('/agenda', requirePermission('tasks.view'), TaskController.getAgenda);
router.get('/overdue', requirePermission('tasks.view'), TaskController.getOverdueTasks);
router.get('/sla-breached', requirePermission('tasks.view'), TaskController.getSlaBreachedTasks);
router.get('/dispositions', requirePermission('tasks.view'), TaskController.listDispositions);

// 2. SLA Policies management
router.get('/sla-policies', requirePermission('tasks.view'), TaskController.listSlaPolicies);
router.put(
  '/sla-policies/:id',
  requirePermission('tasks.manage_sla'),
  validate(slaPolicySchema),
  TaskController.updateSlaPolicy
);

// 3. Intake Follow-up Generation hook
router.post(
  '/generate-lead-followup',
  requirePermission('tasks.create'),
  TaskController.generateLeadFollowup
);

// 4. Task Listing & Creation
router.get('/', requirePermission('tasks.view'), TaskController.getTasks);
router.post('/', requirePermission('tasks.create'), validate(createTaskSchema), TaskController.createTask);

// 5. Individual Task Mutations & State Transitions
router.get('/:id', requirePermission('tasks.view'), TaskController.getTaskById);
router.put('/:id', requirePermission('tasks.edit'), validate(updateTaskSchema), TaskController.updateTask);

// Assignment
router.patch(
  '/:id/assign',
  requirePermission('tasks.assign'),
  validate(assignTaskSchema),
  TaskController.assignTask
);

// Priority & Due Date
router.patch(
  '/:id/priority',
  requirePermission('tasks.edit'),
  validate(updatePrioritySchema),
  TaskController.updatePriority
);
router.patch(
  '/:id/due-date',
  requirePermission('tasks.edit'),
  validate(updateDueDateSchema),
  TaskController.updateDueDate
);

// Lifecycle Transitions
router.post('/:id/start', requirePermission('tasks.complete'), TaskController.startTask);
router.post(
  '/:id/complete',
  requirePermission('tasks.complete'),
  validate(completeTaskSchema),
  TaskController.completeTask
);
router.post('/:id/cancel', requirePermission('tasks.complete'), TaskController.cancelTask);
router.post(
  '/:id/snooze',
  requirePermission('tasks.complete'),
  validate(snoozeTaskSchema),
  TaskController.snoozeTask
);
router.post(
  '/:id/disposition',
  requirePermission('tasks.complete'),
  validate(applyDispositionSchema),
  TaskController.applyDisposition
);

// Audit & Timeline Events
router.get('/:id/events', requirePermission('tasks.view_events'), TaskController.getTaskEvents);

export default router;
