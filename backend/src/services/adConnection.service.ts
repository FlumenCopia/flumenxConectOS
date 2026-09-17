import mongoose from 'mongoose';
import {
  AdPlatformConnection,
  IAdPlatformConnection,
  ConnectionStatus,
  AdPlatformType,
} from '../models/AdPlatformConnection';
import { MetaAdsService } from './providers/metaAds.service';
import { GoogleAdsService } from './providers/googleAds.service';
import { encrypt, decrypt } from '../utils/crypto';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../config/logger';

export class AdConnectionService {
  /**
   * Lists connected ad accounts for a workspace (secrets stripped).
   */
  static async listConnections(clientId: string): Promise<IAdPlatformConnection[]> {
    return AdPlatformConnection.find({
      clientId: new mongoose.Types.ObjectId(clientId),
    })
      .sort({ createdAt: -1 })
      .populate('createdBy', 'name email');
  }

  /**
   * Retrieves single connection (secrets stripped).
   */
  static async getConnectionById(
    clientId: string,
    connectionId: string
  ): Promise<IAdPlatformConnection> {
    const connection = await AdPlatformConnection.findOne({
      _id: new mongoose.Types.ObjectId(connectionId),
      clientId: new mongoose.Types.ObjectId(clientId),
    }).populate('createdBy', 'name email');

    if (!connection) {
      throw new AppError('Ad platform connection not found', 404);
    }
    return connection;
  }

  /**
   * Establishes a new connected ad account.
   * Validates credentials against provider, encrypts tokens, and stores securely.
   */
  static async createConnection(
    clientId: string,
    data: {
      platform: AdPlatformType;
      accountName: string;
      accountId: string;
      accessToken: string;
      refreshToken?: string;
      metadata?: Record<string, any>;
    },
    userId?: string
  ): Promise<IAdPlatformConnection> {
    const clientObjectId = new mongoose.Types.ObjectId(clientId);

    // 1. Validate credentials with provider adapter
    let validationResult;
    try {
      if (data.platform === 'meta') {
        validationResult = await MetaAdsService.validateCredentials(
          data.accessToken,
          data.accountId
        );
      } else {
        validationResult = await GoogleAdsService.validateCredentials(
          data.accessToken,
          data.accountId
        );
      }
    } catch (valErr: any) {
      throw new AppError(`Credential validation failed: ${valErr.message}`, 400);
    }

    // 2. Encrypt credentials at rest
    const encryptedAccessToken = encrypt(data.accessToken);
    const encryptedRefreshToken = data.refreshToken ? encrypt(data.refreshToken) : undefined;

    // 3. Upsert connection
    const connection = await AdPlatformConnection.create({
      clientId: clientObjectId,
      platform: data.platform,
      accountName: data.accountName.trim(),
      accountId: data.accountId.trim(),
      status: 'active',
      encryptedAccessToken,
      encryptedRefreshToken,
      metadata: {
        ...(data.metadata || {}),
        currency: validationResult.currency,
        timezone: validationResult.timezone,
      },
      createdBy: userId ? new mongoose.Types.ObjectId(userId) : undefined,
    });

    return this.getConnectionById(clientId, connection._id.toString());
  }

  /**
   * Verifies credentials against provider and updates status.
   */
  static async validateConnection(
    clientId: string,
    connectionId: string
  ): Promise<{ valid: boolean; status: ConnectionStatus; message: string }> {
    const connection = await AdPlatformConnection.findOne({
      _id: new mongoose.Types.ObjectId(connectionId),
      clientId: new mongoose.Types.ObjectId(clientId),
    }).select('+encryptedAccessToken +encryptedRefreshToken');

    if (!connection) {
      throw new AppError('Ad platform connection not found', 404);
    }

    try {
      const accessToken = decrypt(connection.encryptedAccessToken);
      if (connection.platform === 'meta') {
        await MetaAdsService.validateCredentials(accessToken, connection.accountId);
      } else {
        await GoogleAdsService.validateCredentials(accessToken, connection.accountId);
      }

      connection.status = 'active';
      connection.lastSyncError = undefined;
      await connection.save();

      return {
        valid: true,
        status: 'active',
        message: `${connection.platform.toUpperCase()} connection credentials verified active.`,
      };
    } catch (err: any) {
      logger.warn(`Connection validation failed for ${connectionId}:`, err.message);
      connection.status = err.message.toLowerCase().includes('expired') ? 'expired' : 'error';
      connection.lastSyncError = err.message;
      await connection.save();

      return {
        valid: false,
        status: connection.status,
        message: err.message,
      };
    }
  }

  /**
   * Manually updates connection status (active, expired, revoked, error).
   */
  static async updateConnectionStatus(
    clientId: string,
    connectionId: string,
    status: ConnectionStatus
  ): Promise<IAdPlatformConnection> {
    const connection = await AdPlatformConnection.findOneAndUpdate(
      {
        _id: new mongoose.Types.ObjectId(connectionId),
        clientId: new mongoose.Types.ObjectId(clientId),
      },
      { $set: { status } },
      { new: true }
    );

    if (!connection) {
      throw new AppError('Connection not found', 404);
    }

    return connection;
  }

  /**
   * Revokes an existing connection.
   */
  static async revokeConnection(
    clientId: string,
    connectionId: string,
    userId?: string
  ): Promise<IAdPlatformConnection> {
    const connection = await AdPlatformConnection.findOneAndUpdate(
      {
        _id: new mongoose.Types.ObjectId(connectionId),
        clientId: new mongoose.Types.ObjectId(clientId),
      },
      { $set: { status: 'revoked' } },
      { new: true }
    );

    if (!connection) {
      throw new AppError('Connection not found', 404);
    }

    return connection;
  }

  /**
   * Internal helper: safely retrieves and decrypts stored tokens for sync engine.
   * NEVER exposed in public or HTTP controller responses.
   */
  static async getDecryptedCredentials(
    clientId: string,
    connectionId: string
  ): Promise<{ accessToken: string; refreshToken?: string; accountId: string; platform: AdPlatformType }> {
    const connection = await AdPlatformConnection.findOne({
      _id: new mongoose.Types.ObjectId(connectionId),
      clientId: new mongoose.Types.ObjectId(clientId),
    }).select('+encryptedAccessToken +encryptedRefreshToken');

    if (!connection) {
      throw new AppError('Connection not found', 404);
    }

    if (connection.status === 'revoked') {
      throw new AppError('Cannot sync a revoked connection', 400);
    }

    const accessToken = decrypt(connection.encryptedAccessToken);
    const refreshToken = connection.encryptedRefreshToken
      ? decrypt(connection.encryptedRefreshToken)
      : undefined;

    return {
      accessToken,
      refreshToken,
      accountId: connection.accountId,
      platform: connection.platform,
    };
  }
}
