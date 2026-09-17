import mongoose from 'mongoose';
import { Workflow, IWorkflow, WorkflowStatus } from '../models/Workflow';
import { WorkflowRun, IWorkflowRun } from '../models/WorkflowRun';
import { WorkflowExecutionService } from './workflowExecution.service';
import { ConditionEvaluator } from './conditionEvaluator.service';
import { AuditService } from './audit.service';
import { AppError } from '../middleware/errorHandler';

export class WorkflowService {
  /**
   * Creates a new workflow automation within the tenant workspace.
   */
  public static async createWorkflow(
    clientId: string,
    data: any,
    actor: { id?: string; name?: string; email?: string }
  ): Promise<IWorkflow> {
    const clientObjectId = new mongoose.Types.ObjectId(clientId);

    if (data.actions && data.actions.length > 10) {
      throw new AppError('A workflow cannot have more than 10 actions', 422);
    }
    if (data.conditions && data.conditions.length > 10) {
      throw new AppError('A workflow cannot have more than 10 conditions', 422);
    }

    // Assign sequential IDs to actions if missing
    const actions = (data.actions || []).map((a: any, idx: number) => ({
      ...a,
      id: a.id || `act_${idx + 1}_${Date.now()}`,
      order: a.order !== undefined ? a.order : idx,
    }));

    const workflow = await Workflow.create({
      clientId: clientObjectId,
      name: data.name.trim(),
      description: data.description?.trim(),
      status: data.status || 'draft',
      trigger: data.trigger,
      conditions: data.conditions || [],
      actions,
      executionMode: data.executionMode || 'immediate',
      maxExecutionsPerHour: Number(data.maxExecutionsPerHour) || 100,
      createdBy: actor.id ? new mongoose.Types.ObjectId(actor.id) : undefined,
      updatedBy: actor.id ? new mongoose.Types.ObjectId(actor.id) : undefined,
    });

    try {
      await AuditService.log({
        userId: actor.id,
        userEmail: actor.email,
        clientId,
        action: 'workflow.create',
        resourceType: 'workflow',
        resourceId: workflow._id.toString(),
        metadata: { name: workflow.name, trigger: workflow.trigger.eventType },
      });
    } catch (err) {
      // Non-fatal
    }

    return workflow;
  }

  /**
   * Updates an existing workflow within tenant boundary.
   */
  public static async updateWorkflow(
    clientId: string,
    workflowId: string,
    data: any,
    actor: { id?: string; name?: string; email?: string }
  ): Promise<IWorkflow> {
    if (!mongoose.Types.ObjectId.isValid(workflowId)) {
      throw new AppError('Invalid workflow ID format', 400);
    }

    const workflow = await Workflow.findOne({
      _id: new mongoose.Types.ObjectId(workflowId),
      clientId: new mongoose.Types.ObjectId(clientId),
    });

    if (!workflow) {
      throw new AppError('Workflow not found or access denied', 404);
    }

    if (data.actions && data.actions.length > 10) {
      throw new AppError('A workflow cannot have more than 10 actions', 422);
    }
    if (data.conditions && data.conditions.length > 10) {
      throw new AppError('A workflow cannot have more than 10 conditions', 422);
    }

    if (data.name !== undefined) workflow.name = data.name.trim();
    if (data.description !== undefined) workflow.description = data.description?.trim();
    if (data.status !== undefined) workflow.status = data.status;
    if (data.trigger !== undefined) workflow.trigger = data.trigger;
    if (data.conditions !== undefined) workflow.conditions = data.conditions;
    if (data.actions !== undefined) {
      workflow.actions = data.actions.map((a: any, idx: number) => ({
        ...a,
        id: a.id || `act_${idx + 1}_${Date.now()}`,
        order: a.order !== undefined ? a.order : idx,
      }));
    }
    if (data.executionMode !== undefined) workflow.executionMode = data.executionMode;
    if (data.maxExecutionsPerHour !== undefined) {
      workflow.maxExecutionsPerHour = Number(data.maxExecutionsPerHour) || 100;
    }

    workflow.updatedBy = actor.id ? new mongoose.Types.ObjectId(actor.id) : undefined;
    await workflow.save();

    try {
      await AuditService.log({
        userId: actor.id,
        userEmail: actor.email,
        clientId,
        action: 'workflow.update',
        resourceType: 'workflow',
        resourceId: workflow._id.toString(),
        metadata: { name: workflow.name, status: workflow.status },
      });
    } catch (err) {
      // Non-fatal
    }

    return workflow;
  }

  /**
   * Updates workflow status (active, paused, archived).
   */
  public static async updateWorkflowStatus(
    clientId: string,
    workflowId: string,
    status: WorkflowStatus,
    actor: { id?: string; name?: string; email?: string }
  ): Promise<IWorkflow> {
    if (!mongoose.Types.ObjectId.isValid(workflowId)) {
      throw new AppError('Invalid workflow ID format', 400);
    }

    const workflow = await Workflow.findOneAndUpdate(
      {
        _id: new mongoose.Types.ObjectId(workflowId),
        clientId: new mongoose.Types.ObjectId(clientId),
      },
      {
        $set: {
          status,
          updatedBy: actor.id ? new mongoose.Types.ObjectId(actor.id) : undefined,
        },
      },
      { new: true }
    );

    if (!workflow) {
      throw new AppError('Workflow not found or access denied', 404);
    }

    try {
      await AuditService.log({
        userId: actor.id,
        userEmail: actor.email,
        clientId,
        action: 'workflow.status_change',
        resourceType: 'workflow',
        resourceId: workflow._id.toString(),
        metadata: { status },
      });
    } catch (err) {
      // Non-fatal
    }

    return workflow;
  }

  /**
   * Gets workflow details by ID.
   */
  public static async getWorkflow(clientId: string, workflowId: string): Promise<IWorkflow> {
    if (!mongoose.Types.ObjectId.isValid(workflowId)) {
      throw new AppError('Invalid workflow ID format', 400);
    }

    const workflow = await Workflow.findOne({
      _id: new mongoose.Types.ObjectId(workflowId),
      clientId: new mongoose.Types.ObjectId(clientId),
    }).populate('createdBy', 'name email');

    if (!workflow) {
      throw new AppError('Workflow not found or access denied', 404);
    }

    return workflow;
  }

  /**
   * Lists workflows with filtering and pagination.
   */
  public static async listWorkflows(
    clientId: string,
    query: {
      status?: string;
      eventType?: string;
      search?: string;
      page?: number;
      limit?: number;
    } = {}
  ): Promise<{ workflows: IWorkflow[]; total: number; page: number; totalPages: number }> {
    const filter: Record<string, any> = {
      clientId: new mongoose.Types.ObjectId(clientId),
    };

    if (query.status) {
      filter.status = query.status;
    }
    if (query.eventType) {
      filter['trigger.eventType'] = query.eventType;
    }
    if (query.search) {
      filter.name = { $regex: query.search.trim(), $options: 'i' };
    }

    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const skip = (page - 1) * limit;

    const [workflows, total] = await Promise.all([
      Workflow.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('createdBy', 'name email')
        .lean(),
      Workflow.countDocuments(filter),
    ]);

    return {
      workflows: (workflows as unknown) as IWorkflow[],
      total,
      page,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  /**
   * Deletes a workflow.
   */
  public static async deleteWorkflow(
    clientId: string,
    workflowId: string,
    actor: { id?: string; name?: string; email?: string }
  ): Promise<{ success: boolean }> {
    if (!mongoose.Types.ObjectId.isValid(workflowId)) {
      throw new AppError('Invalid workflow ID format', 400);
    }

    const workflow = await Workflow.findOneAndDelete({
      _id: new mongoose.Types.ObjectId(workflowId),
      clientId: new mongoose.Types.ObjectId(clientId),
    });

    if (!workflow) {
      throw new AppError('Workflow not found or access denied', 404);
    }

    try {
      await AuditService.log({
        userId: actor.id,
        userEmail: actor.email,
        clientId,
        action: 'workflow.delete',
        resourceType: 'workflow',
        resourceId: workflow._id.toString(),
        metadata: { name: workflow.name },
      });
    } catch (err) {
      // Non-fatal
    }

    return { success: true };
  }

  /**
   * Tests workflow conditions against a test payload without executing side-effects.
   */
  public static async testWorkflowConditions(
    clientId: string,
    workflowId: string,
    samplePayload: Record<string, any>
  ): Promise<{ passed: boolean; conditionResults: Array<{ field: string; operator: string; passed: boolean }> }> {
    const workflow = await this.getWorkflow(clientId, workflowId);

    const conditionResults = (workflow.conditions || []).map((cond) => {
      const passed = ConditionEvaluator.evaluateCondition(cond, samplePayload);
      return {
        field: cond.field,
        operator: cond.operator,
        passed,
      };
    });

    const passed = ConditionEvaluator.evaluateAll(workflow.conditions, samplePayload);

    return {
      passed,
      conditionResults,
    };
  }

  /**
   * Manually executes a workflow with test or real payload, applying exact same
   * condition evaluation, atomic execution limits, idempotency, and audit logging.
   */
  public static async executeManualWorkflow(
    clientId: string,
    workflowId: string,
    customPayload: Record<string, any> = {},
    actor: { id?: string; name?: string; email?: string },
    providedEventId?: string
  ): Promise<IWorkflowRun> {
    const workflow = await this.getWorkflow(clientId, workflowId);

    const eventId = providedEventId || `manual_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const normalizedEvent = {
      clientId,
      eventType: 'manual.trigger',
      eventId,
      occurredAt: new Date(),
      payload: customPayload,
      actor,
      depth: 0,
    };

    return await WorkflowExecutionService.executeWorkflow(workflow, normalizedEvent);
  }

  /**
   * Lists execution runs for workflows within tenant boundary.
   */
  public static async listWorkflowRuns(
    clientId: string,
    query: {
      workflowId?: string;
      status?: string;
      page?: number;
      limit?: number;
    } = {}
  ): Promise<{ runs: IWorkflowRun[]; total: number; page: number; totalPages: number }> {
    const filter: Record<string, any> = {
      clientId: new mongoose.Types.ObjectId(clientId),
    };

    if (query.workflowId && mongoose.Types.ObjectId.isValid(query.workflowId)) {
      filter.workflowId = new mongoose.Types.ObjectId(query.workflowId);
    }
    if (query.status) {
      filter.status = query.status;
    }

    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const skip = (page - 1) * limit;

    const [runs, total] = await Promise.all([
      WorkflowRun.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('workflowId', 'name status trigger')
        .lean(),
      WorkflowRun.countDocuments(filter),
    ]);

    return {
      runs: (runs as unknown) as IWorkflowRun[],
      total,
      page,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  /**
   * Retrieves single workflow run details.
   */
  public static async getWorkflowRun(clientId: string, runId: string): Promise<IWorkflowRun> {
    if (!mongoose.Types.ObjectId.isValid(runId)) {
      throw new AppError('Invalid workflow run ID format', 400);
    }

    const run = await WorkflowRun.findOne({
      _id: new mongoose.Types.ObjectId(runId),
      clientId: new mongoose.Types.ObjectId(clientId),
    }).populate('workflowId', 'name status trigger conditions actions');

    if (!run) {
      throw new AppError('Workflow run not found or access denied', 404);
    }

    return run;
  }
}
