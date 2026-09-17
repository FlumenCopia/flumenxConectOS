import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { Client } from '../models/Client';
import { ClientMembership } from '../models/ClientMembership';
import { sendError } from '../utils/response';
import { AuditService } from '../services/audit.service';

/**
 * Enforces strict client-level data isolation.
 * Resolves the client workspace context and ensures non-admin users cannot
 * access or manipulate resources belonging to another client.
 */
export const requireClientAccess = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  if (!req.user) {
    sendError(res, 'Authentication required before verifying client access.', 401);
    return;
  }

  // Extract clientId candidates from route parameters, query string, headers, and body
  let rawSources = [
    req.params.clientId,
    req.query.clientId,
    req.headers['x-client-id'] as string,
    req.body?.clientId,
  ].filter(Boolean).map((s) => s.toString().trim());

  if (rawSources.length === 0 && (req.auth as any)?.activeClientId) {
    rawSources = [(req.auth as any).activeClientId.toString().trim()];
  }

  if (rawSources.length === 0 && req.user.isSuperAdmin) {
    const defaultClient = await Client.findOne({ status: 'active', isArchived: { $ne: true } });
    if (defaultClient) {
      rawSources = [defaultClient._id.toString()];
    }
  }

  if (rawSources.length === 0) {
    sendError(res, 'Client identifier (clientId) is required for this workspace operation.', 400);
    return;
  }

  // Prevent client parameter pollution / tenant confusion attacks: all supplied IDs must match
  const allMatch = rawSources.every((id) => id === rawSources[0]);
  if (!allMatch) {
    await AuditService.log({
      userId: req.user._id,
      userEmail: req.user.email,
      action: 'auth.client_access.tampering',
      resourceType: 'client',
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      success: false,
      metadata: { path: req.originalUrl, detectedClientIds: rawSources },
    });

    sendError(res, 'Access denied: Conflicting client workspace identifiers detected.', 403);
    return;
  }

  const clientIdStr = rawSources[0];

  // Validate ObjectId structure
  if (!mongoose.Types.ObjectId.isValid(clientIdStr)) {
    sendError(res, 'Invalid client identifier format.', 400);
    return;
  }

  try {
    // 1. Super Admin access (governed by database-driven super_admin role permissions)
    if (req.user.isSuperAdmin) {
      const { Role } = await import('../models/Role');
      const superAdminRole = await Role.findOne({ slug: 'super_admin' });
      if (superAdminRole && superAdminRole.permissionCodes.includes('clients.view')) {
        const client = await Client.findById(clientIdStr);
        if (!client) {
          sendError(res, 'Client workspace not found.', 404);
          return;
        }
        req.resolvedClientId = clientIdStr;
        next();
        return;
      }
    }

    // 2. Regular User Workspace Verification
    const membership = await ClientMembership.findOne({
      userId: req.user._id,
      clientId: clientIdStr,
      status: 'active',
    }).populate('clientId', 'status').populate('roleId');

    if (!membership || !membership.clientId) {
      await AuditService.log({
        userId: req.user._id,
        userEmail: req.user.email,
        clientId: clientIdStr,
        action: 'auth.client_access.violation',
        resourceType: 'client',
        resourceId: clientIdStr,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        success: false,
        metadata: { path: req.originalUrl },
      });

      // Avoid leaking whether another client's record exists: return consistent 403 Forbidden
      sendError(res, 'Access denied: You are not authorized to access this client workspace.', 403);
      return;
    }

    const client = membership.clientId as any;
    if (client.status === 'suspended') {
      sendError(res, 'Client workspace is currently suspended. Please contact FlumenX support.', 403);
      return;
    }

    req.resolvedClientId = clientIdStr;
    req.clientMembership = membership;
    next();
  } catch (error: any) {
    sendError(res, `Failed to verify client authorization: ${error.message}`, 500);
  }
};

export const resolveClient = requireClientAccess;
