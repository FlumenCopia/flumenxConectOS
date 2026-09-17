import mongoose from 'mongoose';
import { AdPlatformConnection } from '../models/AdPlatformConnection';
import { AdCampaign } from '../models/AdCampaign';
import { AdSet } from '../models/AdSet';
import { Ad } from '../models/Ad';
import { AdSpendDaily } from '../models/AdSpendDaily';
import { AdConnectionService } from './adConnection.service';
import { MetaAdsService } from './providers/metaAds.service';
import { GoogleAdsService } from './providers/googleAds.service';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../config/logger';

export interface SyncResult {
  connectionId: string;
  platform: string;
  status: 'success' | 'partial' | 'failed';
  campaignsCount: number;
  adSetsCount: number;
  adsCount: number;
  dailySpendEntriesCount: number;
  error?: string;
  warnings?: string[];
}

export class AdSyncService {
  /**
   * Synchronizes campaigns, ad sets, ads, and daily spend for a connection.
   * Completely idempotent: repeated syncs update existing documents without creating duplicates.
   */
  static async syncConnection(
    clientId: string,
    connectionId: string
  ): Promise<SyncResult> {
    const clientObjectId = new mongoose.Types.ObjectId(clientId);
    const connObjectId = new mongoose.Types.ObjectId(connectionId);

    const connection = await AdPlatformConnection.findOne({
      _id: connObjectId,
      clientId: clientObjectId,
    });
    if (!connection) {
      throw new AppError('Connection not found', 404);
    }

    let credentials;
    try {
      credentials = await AdConnectionService.getDecryptedCredentials(clientId, connectionId);
    } catch (credErr: any) {
      connection.status = 'error';
      connection.lastSyncStatus = 'failed';
      connection.lastSyncError = credErr.message;
      await connection.save();
      throw credErr;
    }

    const warnings: string[] = [];
    let syncedCampaigns = 0;
    let syncedAdSets = 0;
    let syncedAds = 0;
    let syncedSpend = 0;

    try {
      // 1. Fetch campaigns from provider
      let rawCampaigns: any[] = [];
      if (credentials.platform === 'meta') {
        rawCampaigns = await MetaAdsService.fetchCampaigns(credentials.accessToken, credentials.accountId);
      } else {
        rawCampaigns = await GoogleAdsService.fetchCampaigns(credentials.accessToken, credentials.accountId);
      }

      // Upsert campaigns
      const campaignMap = new Map<string, mongoose.Types.ObjectId>();
      for (const c of rawCampaigns) {
        const campaignDoc = await AdCampaign.findOneAndUpdate(
          {
            clientId: clientObjectId,
            platform: credentials.platform,
            externalCampaignId: c.externalCampaignId,
          },
          {
            $set: {
              connectionId: connObjectId,
              name: c.name,
              status: c.status,
              objective: c.objective,
              dailyBudget: c.dailyBudget,
              lifetimeBudget: c.lifetimeBudget,
              currency: c.currency,
              startTime: c.startTime,
              endTime: c.endTime,
              metrics: c.metrics,
              lastSyncedAt: new Date(),
            },
          },
          { upsert: true, new: true }
        );
        campaignMap.set(c.externalCampaignId, campaignDoc._id);
        syncedCampaigns++;
      }

      // 2. Fetch and upsert AdSets / Ad Groups (gracefully handling partial failure)
      try {
        let rawAdSets: any[] = [];
        if (credentials.platform === 'meta') {
          rawAdSets = await MetaAdsService.fetchAdSets(credentials.accessToken, credentials.accountId);
        } else {
          rawAdSets = await GoogleAdsService.fetchAdSets(credentials.accessToken, credentials.accountId);
        }

        for (const set of rawAdSets) {
          const campaignId = campaignMap.get(set.externalCampaignId);
          if (!campaignId) continue;

          await AdSet.findOneAndUpdate(
            {
              clientId: clientObjectId,
              externalAdSetId: set.externalAdSetId,
            },
            {
              $set: {
                campaignId,
                connectionId: connObjectId,
                platform: credentials.platform,
                name: set.name,
                status: set.status,
                dailyBudget: set.dailyBudget,
                targetingSummary: set.targetingSummary,
                metrics: set.metrics,
                lastSyncedAt: new Date(),
              },
            },
            { upsert: true, new: true }
          );
          syncedAdSets++;
        }
      } catch (adSetErr: any) {
        logger.warn(`Partial sync error on ad sets for connection ${connectionId}:`, adSetErr.message);
        warnings.push(`AdSets sync: ${adSetErr.message}`);
      }

      // 3. Fetch and upsert Ads & Creatives
      try {
        let rawAds: any[] = [];
        if (credentials.platform === 'meta') {
          rawAds = await MetaAdsService.fetchAds(credentials.accessToken, credentials.accountId);
        } else {
          rawAds = await GoogleAdsService.fetchAds(credentials.accessToken, credentials.accountId);
        }

        for (const ad of rawAds) {
          const campaignId = campaignMap.get(ad.externalCampaignId);
          const adSetDoc = await AdSet.findOne({ clientId: clientObjectId, externalAdSetId: ad.externalAdSetId });
          if (!campaignId || !adSetDoc) continue;

          await Ad.findOneAndUpdate(
            {
              clientId: clientObjectId,
              externalAdId: ad.externalAdId,
            },
            {
              $set: {
                adSetId: adSetDoc._id,
                campaignId,
                connectionId: connObjectId,
                platform: credentials.platform,
                name: ad.name,
                status: ad.status,
                creative: ad.creative,
                metrics: ad.metrics,
                lastSyncedAt: new Date(),
              },
            },
            { upsert: true, new: true }
          );
          syncedAds++;
        }
      } catch (adErr: any) {
        logger.warn(`Partial sync error on ads for connection ${connectionId}:`, adErr.message);
        warnings.push(`Ads sync: ${adErr.message}`);
      }

      // 4. Fetch and upsert Daily Spend Records
      try {
        let rawDailySpend: any[] = [];
        if (credentials.platform === 'meta') {
          rawDailySpend = await MetaAdsService.fetchDailySpend(credentials.accessToken, credentials.accountId);
        } else {
          rawDailySpend = await GoogleAdsService.fetchDailySpend(credentials.accessToken, credentials.accountId);
        }

        for (const entry of rawDailySpend) {
          const campaignId = campaignMap.get(entry.externalCampaignId);

          await AdSpendDaily.findOneAndUpdate(
            {
              clientId: clientObjectId,
              platform: credentials.platform,
              externalCampaignId: entry.externalCampaignId,
              date: entry.date,
            },
            {
              $set: {
                connectionId: connObjectId,
                campaignId,
                spend: entry.spend,
                impressions: entry.impressions,
                clicks: entry.clicks,
                conversions: entry.conversions,
                leads: entry.leads,
                currency: entry.currency || 'USD',
              },
            },
            { upsert: true, new: true }
          );
          syncedSpend++;
        }
      } catch (spendErr: any) {
        logger.warn(`Daily spend sync error for connection ${connectionId}:`, spendErr.message);
        warnings.push(`Daily spend sync: ${spendErr.message}`);
      }

      // 5. Update Connection Sync Status
      const syncStatus: 'success' | 'partial' = warnings.length > 0 ? 'partial' : 'success';
      connection.lastSyncAt = new Date();
      connection.lastSyncStatus = syncStatus;
      connection.lastSyncError = warnings.length > 0 ? warnings.join('; ') : undefined;
      await connection.save();

      return {
        connectionId,
        platform: credentials.platform,
        status: syncStatus,
        campaignsCount: syncedCampaigns,
        adSetsCount: syncedAdSets,
        adsCount: syncedAds,
        dailySpendEntriesCount: syncedSpend,
        warnings: warnings.length > 0 ? warnings : undefined,
      };
    } catch (fatalErr: any) {
      logger.error(`Fatal sync failure for connection ${connectionId}:`, fatalErr);
      connection.lastSyncAt = new Date();
      connection.lastSyncStatus = 'failed';
      connection.lastSyncError = fatalErr.message;
      if (fatalErr.message.toLowerCase().includes('expired') || fatalErr.message.toLowerCase().includes('invalid')) {
        connection.status = 'error';
      }
      await connection.save();

      return {
        connectionId,
        platform: credentials.platform,
        status: 'failed',
        campaignsCount: syncedCampaigns,
        adSetsCount: syncedAdSets,
        adsCount: syncedAds,
        dailySpendEntriesCount: syncedSpend,
        error: fatalErr.message,
      };
    }
  }

  /**
   * Syncs all active connections for a workspace.
   */
  static async syncAllActiveConnections(clientId: string): Promise<SyncResult[]> {
    const clientObjectId = new mongoose.Types.ObjectId(clientId);
    const activeConnections = await AdPlatformConnection.find({
      clientId: clientObjectId,
      status: 'active',
    });

    const results: SyncResult[] = [];
    for (const conn of activeConnections) {
      const res = await this.syncConnection(clientId, conn._id.toString());
      results.push(res);
    }
    return results;
  }
}
