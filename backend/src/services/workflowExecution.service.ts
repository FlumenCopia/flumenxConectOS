import mongoose from 'mongoose';
import { Workflow, IWorkflow } from '../models/Workflow';
import { WorkflowRun, IWorkflowRun } from '../models/WorkflowRun';
import { ConditionEvaluator } from './conditionEvaluator.service';
import { ActionExecutor, IActionResultSummary } from './actionExecutor.service';
import { AuditService } from './audit.service';
import { logger } from '../config/logger';

export interface INormalizedWorkflowEvent {
  clientId: string;
  eventType: string;
  eventId: string;
  occurredAt: Date;
  payload: Record<string, any>;
  entityId?: string;
  entityType?: string;
  depth?: number;
  sourceRunId?: string;
  actor?: { id?: string; name?: string; email?: string };
}

export class WorkflowExecutionService {
  /**
   * Atomically reserves an execution slot for the workflow within the current hour.
   * Race-safe atomic operation: guarantees concurrent events cannot bypass maxExecutionsPerHour.
   */
  public static async reserveHourlyExecutionSlot(workflow: IWorkflow): Promise<boolean> {
    const currentHourBucket = new Date().toISOString().slice(0, 13); // e.g. "2026-09-14T17"
    const maxLimit = workflow.maxExecutionsPerHour || 100;

    // 1. Try matching the current hour bucket where count < maxLimit
    let updated = await Workflow.findOneAndUpdate(
      {
        _id: workflow._id,
        clientId: workflow.clientId,
        executionHourBucket: currentHourBucket,
        hourlyExecutionCount: { $lt: maxLimit },
      },
      {
        $inc: { hourlyExecutionCount: 1 },
        $set: { lastExecutedAt: new Date() },
      },
      { new: true }
    );

    if (updated) {
      return true;
    }

    // 2. If bucket doesn't match current hour, atomically initialize new bucket with count = 1
    updated = await Workflow.findOneAndUpdate(
      {
        _id: workflow._id,
        clientId: workflow.clientId,
        executionHourBucket: { $ne: currentHourBucket },
      },
      {
        $set: {
          executionHourBucket: currentHourBucket,
          hourlyExecutionCount: 1,
          lastExecutedAt: new Date(),
        },
      },
      { new: true }
    );

    return !!updated;
  }

  /**
   * Executes a workflow with idempotency, loop prevention, and action isolation.
   */
  public static async executeWorkflow(
    workflow: IWorkflow,
    event: INormalizedWorkflowEvent
  ): Promise<IWorkflowRun> {
    const clientObjectId = new mongoose.Types.ObjectId(event.clientId);
    const workflowObjectId = workflow._id as mongoose.Types.ObjectId;
    const idempotencyKey = `${workflowObjectId.toString()}:${event.eventId}`;

    // 1. Check existing execution for duplicate prevention
    const existingRun = await WorkflowRun.findOne({
      clientId: clientObjectId,
      idempotencyKey,
    });

    if (existingRun && (existingRun.status === 'completed' || existingRun.status === 'running')) {
      logger.info(
        `Idempotent duplicate event detected for workflow ${workflow._id} event ${event.eventId}; skipping.`
      );
      return existingRun;
    }

    // 2. Persist WorkflowRun record before execution (Non-blocking dispatch persistence)
    let run: IWorkflowRun;
    if (existingRun) {
      run = existingRun;
      run.status = 'running';
      run.startedAt = new Date();
      await run.save();
    } else {
      try {
        run = await WorkflowRun.create({
          clientId: clientObjectId,
          workflowId: workflowObjectId,
          eventType: event.eventType,
          eventId: event.eventId,
          status: 'running',
          startedAt: new Date(),
          idempotencyKey,
          metadata: {
            depth: event.depth || 0,
            sourceRunId: event.sourceRunId,
            actor: event.actor,
          },
        });
      } catch (insertErr: any) {
        // In case of race collision on unique index
        if (insertErr.code === 11000) {
          logger.info(`Concurrent duplicate run caught by MongoDB unique index for ${idempotencyKey}`);
          const duplicate = await WorkflowRun.findOne({ clientId: clientObjectId, idempotencyKey });
          if (duplicate) return duplicate;
        }
        throw insertErr;
      }
    }

    // 3. Loop Protection: Enforce maximum cascading execution depth (max 3)
    const currentDepth = event.depth || 0;
    if (currentDepth >= 3) {
      run.status = 'skipped';
      run.error = 'Loop prevention: maximum cascading execution depth (3) reached';
      run.completedAt = new Date();
      await run.save();
      logger.warn(`Loop prevention triggered for workflow ${workflow._id} at depth ${currentDepth}`);
      return run;
    }

    // 4. Rate Limit Protection: Race-safe atomic hourly execution limit
    const hasSlot = await this.reserveHourlyExecutionSlot(workflow);
    if (!hasSlot) {
      run.status = 'skipped';
      run.error = `Rate limit exceeded: maximum ${workflow.maxExecutionsPerHour} executions per hour reached`;
      run.completedAt = new Date();
      await run.save();
      logger.warn(`Hourly rate limit exceeded for workflow ${workflow._id}`);
      return run;
    }

    // 5. Build full evaluation context
    const evaluationContext = {
      event: {
        eventType: event.eventType,
        eventId: event.eventId,
        occurredAt: event.occurredAt,
      },
      ...event.payload,
    };

    // 6. Evaluate Workflow Conditions safely
    const conditionsMet = ConditionEvaluator.evaluateAll(workflow.conditions, evaluationContext);
    if (!conditionsMet) {
      run.status = 'skipped';
      run.error = 'Conditions not met';
      run.completedAt = new Date();
      await run.save();
      return run;
    }

    // 7. Check for empty workflow actions
    if (!workflow.actions || workflow.actions.length === 0) {
      run.status = 'completed';
      run.completedAt = new Date();
      await run.save();
      return run;
    }

    // 8. Execute Actions Pipeline
    const sortedActions = [...workflow.actions].sort((a, b) => (a.order || 0) - (b.order || 0));
    const actionResults: IActionResultSummary[] = [];
    let hasFailedAction = false;
    let errorMessage: string | undefined;

    for (const action of sortedActions) {
      const result = await ActionExecutor.executeAction(action, workflow, run, evaluationContext);
      actionResults.push(result);

      if (result.status === 'failed') {
        hasFailedAction = true;
        if (!errorMessage) errorMessage = result.error;
      }

      // If action is pause_workflow, break action loop
      if (action.type === 'pause_workflow') {
        break;
      }
    }

    // 9. Update Run Status and Audit Log
    run.actionResults = actionResults as any;
    run.status = hasFailedAction ? 'failed' : 'completed';
    run.error = errorMessage;
    run.completedAt = new Date();
    await run.save();

    // 10. Operational Audit Log
    try {
      await AuditService.log({
        userId: event.actor?.id,
        userEmail: event.actor?.email,
        clientId: workflow.clientId.toString(),
        action: 'workflow.execute',
        resourceType: 'workflow',
        resourceId: workflow._id.toString(),
        success: !hasFailedAction,
        metadata: {
          runId: run._id.toString(),
          eventType: event.eventType,
          actionsExecuted: actionResults.length,
          status: run.status,
        },
      });
    } catch (auditErr) {
      // Non-fatal
    }

    return run;
  }
}
