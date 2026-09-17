import { IWorkflowCondition } from '../models/Workflow';
import { logger } from '../config/logger';

export class ConditionEvaluator {
  private static ALLOWED_ROOTS = new Set([
    'lead',
    'task',
    'form',
    'conversation',
    'message',
    'submission',
    'payload',
    'event',
  ]);

  /**
   * Safely extracts a nested property using an explicit allowlist.
   * Disallows prototype pollution and arbitrary expression traversal.
   */
  public static extractFieldValue(obj: Record<string, any>, path: string): any {
    if (!obj || typeof obj !== 'object' || !path || typeof path !== 'string') {
      return undefined;
    }

    const cleanPath = path.trim();
    const parts = cleanPath.split('.');
    const root = parts[0];

    // Explicit allowlist check
    if (!this.ALLOWED_ROOTS.has(root)) {
      logger.warn(`Rejected unallowlisted condition field root: ${root}`);
      return undefined;
    }

    let current: any = obj;
    for (const part of parts) {
      if (current === null || current === undefined) {
        return undefined;
      }
      // Prototype pollution defense
      if (part === '__proto__' || part === 'constructor' || part === 'prototype') {
        logger.warn(`Security alert: Attempted prototype access via condition path: ${path}`);
        return undefined;
      }
      current = current[part];
    }

    return current;
  }

  /**
   * Evaluates a single condition rule safely against the context.
   */
  public static evaluateCondition(
    condition: IWorkflowCondition,
    context: Record<string, any>
  ): boolean {
    const { field, operator, value } = condition;
    const actual = this.extractFieldValue(context, field);

    // Defense against MongoDB query injection via condition value
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const keys = Object.keys(value);
      if (keys.some((k) => k.startsWith('$'))) {
        logger.warn(`Rejected unsafe MongoDB operator in condition value: ${JSON.stringify(value)}`);
        return false;
      }
    }

    switch (operator) {
      case 'exists': {
        return actual !== undefined && actual !== null && actual !== '';
      }

      case 'equals': {
        if (actual === undefined || actual === null) {
          return value === null || value === undefined;
        }
        if (typeof actual === 'string' && typeof value === 'string') {
          return actual.toLowerCase().trim() === value.toLowerCase().trim();
        }
        if (typeof actual === 'number' && typeof value === 'string') {
          const num = Number(value);
          return !isNaN(num) && actual === num;
        }
        return actual === value;
      }

      case 'not_equals': {
        return !this.evaluateCondition({ ...condition, operator: 'equals' }, context);
      }

      case 'contains': {
        if (Array.isArray(actual)) {
          if (value === undefined || value === null) return false;
          return actual.some((item) =>
            typeof item === 'string' && typeof value === 'string'
              ? item.toLowerCase().trim() === value.toLowerCase().trim()
              : item === value
          );
        }
        if (typeof actual === 'string' && typeof value === 'string') {
          return actual.toLowerCase().includes(value.toLowerCase().trim());
        }
        return false;
      }

      case 'starts_with': {
        if (typeof actual === 'string' && typeof value === 'string') {
          return actual.toLowerCase().startsWith(value.toLowerCase().trim());
        }
        return false;
      }

      case 'greater_than': {
        const actualNum = Number(actual);
        const targetNum = Number(value);
        if (!isNaN(actualNum) && !isNaN(targetNum)) {
          return actualNum > targetNum;
        }
        // Date comparison
        if (actual instanceof Date || (typeof actual === 'string' && !isNaN(Date.parse(actual)))) {
          const actualDate = new Date(actual).getTime();
          const targetDate = new Date(value).getTime();
          return actualDate > targetDate;
        }
        return false;
      }

      case 'less_than': {
        const actualNum = Number(actual);
        const targetNum = Number(value);
        if (!isNaN(actualNum) && !isNaN(targetNum)) {
          return actualNum < targetNum;
        }
        // Date comparison
        if (actual instanceof Date || (typeof actual === 'string' && !isNaN(Date.parse(actual)))) {
          const actualDate = new Date(actual).getTime();
          const targetDate = new Date(value).getTime();
          return actualDate < targetDate;
        }
        return false;
      }

      case 'in_list': {
        let list: any[] = [];
        if (Array.isArray(value)) {
          list = value;
        } else if (typeof value === 'string') {
          list = value.split(',').map((s) => s.trim());
        } else {
          return false;
        }

        if (typeof actual === 'string') {
          const cleanActual = actual.toLowerCase().trim();
          return list.some((item) => String(item).toLowerCase().trim() === cleanActual);
        }
        return list.includes(actual);
      }

      default:
        logger.warn(`Unknown condition operator: ${operator}`);
        return false;
    }
  }

  /**
   * Evaluates all conditions for a workflow against a normalized event context.
   * Defaults to 'AND' logic across conditions unless specified otherwise.
   */
  public static evaluateAll(
    conditions: IWorkflowCondition[],
    context: Record<string, any>
  ): boolean {
    if (!conditions || conditions.length === 0) {
      return true; // No conditions means always match trigger
    }

    let result = true;
    for (let i = 0; i < conditions.length; i++) {
      const cond = conditions[i];
      const match = this.evaluateCondition(cond, context);

      if (i === 0) {
        result = match;
      } else {
        const logical = cond.logicalOperator || 'and';
        if (logical === 'or') {
          result = result || match;
        } else {
          result = result && match;
        }
      }
    }

    return result;
  }
}
