import { connectDatabase, disconnectDatabase } from '../config/db';
import { env } from '../config/env';
import { logger } from '../config/logger';
import { seedDatabase } from './seedSuperAdmin';
import { User } from '../models/User';
import { Client } from '../models/Client';
import { ClientMembership } from '../models/ClientMembership';
import { ClientInvitation } from '../models/ClientInvitation';
import { ClientWebhook } from '../models/ClientWebhook';
import { ClientActivity } from '../models/ClientActivity';
import { Conversation } from '../models/Conversation';
import { ConversationActivity } from '../models/ConversationActivity';
import { Message } from '../models/Message';
import { Contact } from '../models/Contact';
import { BroadcastCampaign } from '../models/BroadcastCampaign';
import { TaskDisposition } from '../models/TaskDisposition';
import { SlaPolicy } from '../models/SlaPolicy';
import { Lead } from '../models/Lead';
import { LeadActivity } from '../models/LeadActivity';
import { LeadAttribution } from '../models/LeadAttribution';
import { Task } from '../models/Task';
import { TaskEvent } from '../models/TaskEvent';
import { WebsiteForm } from '../models/WebsiteForm';
import { WebsiteFormField } from '../models/WebsiteFormField';
import { FormSubmission } from '../models/FormSubmission';
import { FormSubmissionEvent } from '../models/FormSubmissionEvent';
import { Workflow } from '../models/Workflow';
import { WorkflowRun } from '../models/WorkflowRun';
import { PortalInvitation } from '../models/PortalInvitation';
import { PortalUser } from '../models/PortalUser';
import { CustomerRequest } from '../models/CustomerRequest';
import { Notification } from '../models/Notification';
import { CommunicationProvider } from '../models/CommunicationProvider';
import { AdPlatformConnection } from '../models/AdPlatformConnection';
import { AdCampaign } from '../models/AdCampaign';
import { AdSet } from '../models/AdSet';
import { Ad } from '../models/Ad';
import { AdSpendDaily } from '../models/AdSpendDaily';
import { SavedReport } from '../models/SavedReport';
import { ReportSnapshot } from '../models/ReportSnapshot';
import { AuditLog } from '../models/AuditLog';

export const cleanDatabase = async () => {
  logger.info('========================================================');
  logger.info('Starting flumenxConectOS Database Cleanup (Purging Dummy Data)...');
  logger.info('========================================================');

  const adminEmail = env.INITIAL_ADMIN_EMAIL.toLowerCase().trim();

  // 1. Purge all non-super-admin users (leaving ONLY primary Super Admin)
  const usersDeleted = await User.deleteMany({ email: { $ne: adminEmail } });
  logger.info(`[✓] Deleted ${usersDeleted.deletedCount} dummy / non-admin user accounts`);

  // 2. Purge all client workspaces and workspace configurations
  const clientsDeleted = await Client.deleteMany({});
  logger.info(`[✓] Deleted ${clientsDeleted.deletedCount} client workspaces`);

  const membershipsDeleted = await ClientMembership.deleteMany({});
  logger.info(`[✓] Deleted ${membershipsDeleted.deletedCount} client memberships`);

  await ClientInvitation.deleteMany({});
  await ClientWebhook.deleteMany({});
  await ClientActivity.deleteMany({});

  // 3. Purge communication, messaging, and CRM data
  const conversationsDeleted = await Conversation.deleteMany({});
  const messagesDeleted = await Message.deleteMany({});
  const contactsDeleted = await Contact.deleteMany({});
  const broadcastsDeleted = await BroadcastCampaign.deleteMany({});
  await ConversationActivity.deleteMany({});
  await CommunicationProvider.deleteMany({});
  logger.info(
    `[✓] Deleted ${conversationsDeleted.deletedCount} conversations, ${messagesDeleted.deletedCount} messages, ${contactsDeleted.deletedCount} contacts, ${broadcastsDeleted.deletedCount} broadcasts`
  );

  // 4. Purge Tasks, SLAs, and Dispositions
  const tasksDeleted = await Task.deleteMany({});
  await TaskEvent.deleteMany({});
  const dispositionsDeleted = await TaskDisposition.deleteMany({});
  const slasDeleted = await SlaPolicy.deleteMany({});
  logger.info(
    `[✓] Deleted ${tasksDeleted.deletedCount} tasks, ${dispositionsDeleted.deletedCount} task dispositions, ${slasDeleted.deletedCount} SLA policies`
  );

  // 5. Purge Leads, Forms, Workflows, Ads, Portals, Reports, and Notifications
  await Lead.deleteMany({});
  await LeadActivity.deleteMany({});
  await LeadAttribution.deleteMany({});
  await WebsiteForm.deleteMany({});
  await WebsiteFormField.deleteMany({});
  await FormSubmission.deleteMany({});
  await FormSubmissionEvent.deleteMany({});
  await Workflow.deleteMany({});
  await WorkflowRun.deleteMany({});
  await PortalInvitation.deleteMany({});
  await PortalUser.deleteMany({});
  await CustomerRequest.deleteMany({});
  await Notification.deleteMany({});
  await AdPlatformConnection.deleteMany({});
  await AdCampaign.deleteMany({});
  await AdSet.deleteMany({});
  await Ad.deleteMany({});
  await AdSpendDaily.deleteMany({});
  await SavedReport.deleteMany({});
  await ReportSnapshot.deleteMany({});
  await AuditLog.deleteMany({});
  logger.info('[✓] Purged leads, forms, workflows, ads, customer requests, and audit logs');

  // 6. Ensure standard permissions, roles, and the initial Super Admin are seeded and healthy
  logger.info('[*] Synchronizing essentials: System Permissions, Roles, and Super Admin...');
  await seedDatabase();

  logger.info('========================================================');
  logger.info('Database cleanup complete! Only Super Admin and essentials remain.');
  logger.info(`Active Super Admin: ${adminEmail}`);
  logger.info('========================================================');
};

if (require.main === module) {
  (async () => {
    try {
      await connectDatabase();
      await cleanDatabase();
      await disconnectDatabase();
      process.exit(0);
    } catch (err) {
      logger.error('Database cleanup failed:', err);
      process.exit(1);
    }
  })();
}
