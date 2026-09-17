import crypto from 'crypto';
import mongoose from 'mongoose';
import { Workflow } from '../models/Workflow';
import { WorkflowExecutionService, INormalizedWorkflowEvent } from './workflowExecution.service';
import { logger } from '../config/logger';

export interface IDispatchEventParams {
  clientId: string;
  eventType: string;
  eventId?: string;
  payload: Record<string, any>;
  entityId?: string;
  entityType?: string;
  actor?: { id?: string; name?: string; email?: string };
  depth?: number;
  sourceRunId?: string;
}

export class EventDispatcher {
  /**
   * Dispatches a normalized event to all matching active workflows for a tenant.
   * Execution is non-blocking to the caller while guaranteeing database-backed run persistence.
   */
  public static async dispatch(params: IDispatchEventParams): Promise<{ dispatchedCount: number }> {
    try {
      const eventId =
        params.eventId ||
        `evt_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`;

      const rawClientId = params.clientId as any;
      const cleanClientId: string =
        typeof rawClientId === 'object' && rawClientId !== null && '_id' in rawClientId
          ? rawClientId._id.toString()
          : typeof rawClientId === 'string'
          ? rawClientId
          : rawClientId?.toString?.() || String(rawClientId);

      const normalizedEvent: INormalizedWorkflowEvent = {
        clientId: cleanClientId,
        eventType: params.eventType,
        eventId,
        occurredAt: new Date(),
        payload: params.payload || {},
        entityId: params.entityId?.toString(),
        entityType: params.entityType,
        depth: params.depth || 0,
        sourceRunId: params.sourceRunId,
        actor: params.actor,
      };

      // Query all ACTIVE workflows in this client workspace matching the event trigger
      const matchingWorkflows = await Workflow.find({
        clientId: new mongoose.Types.ObjectId(cleanClientId),
        status: 'active',
        'trigger.eventType': params.eventType,
      });

      if (!matchingWorkflows || matchingWorkflows.length === 0) {
        return { dispatchedCount: 0 };
      }

      logger.info(
        `[EventDispatcher] Dispatched '${params.eventType}' (event ${eventId}) to ${matchingWorkflows.length} workflow(s) for client ${params.clientId}`
      );

      // Execute each matching workflow safely
      for (const workflow of matchingWorkflows) {
        try {
          // If immediate mode, await; if async, run in background
          if (workflow.executionMode === 'async') {
            setImmediate(() => {
              WorkflowExecutionService.executeWorkflow(workflow, normalizedEvent).catch((err) => {
                logger.error(`Async workflow ${workflow._id} execution failed:`, err);
              });
            });
          } else {
            await WorkflowExecutionService.executeWorkflow(workflow, normalizedEvent);
          }
        } catch (execErr) {
          logger.error(`Error executing workflow ${workflow._id}:`, execErr);
        }
      }

      return { dispatchedCount: matchingWorkflows.length };
    } catch (err) {
      logger.error(`[EventDispatcher] Failed to dispatch event '${params.eventType}':`, err);
      return { dispatchedCount: 0 };
    }
  }
}
