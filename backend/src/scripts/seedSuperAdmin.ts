import bcrypt from 'bcryptjs';
import { connectDatabase, disconnectDatabase } from '../config/db';
import { env } from '../config/env';
import { logger } from '../config/logger';
import { User } from '../models/User';
import { Role } from '../models/Role';
import { Permission } from '../models/Permission';
import { Client } from '../models/Client';
import { ClientMembership } from '../models/ClientMembership';
import { AuditService } from '../services/audit.service';

export const standardPermissions = [
  { code: 'dashboard.view', module: 'dashboard', name: 'View Dashboard', description: 'Access workspace and analytics dashboards' },
  { code: 'clients.view', module: 'clients', name: 'View Clients', description: 'View client accounts and details' },
  { code: 'clients.create', module: 'clients', name: 'Create Clients', description: 'Provision new client workspaces' },
  { code: 'clients.update', module: 'clients', name: 'Update Clients', description: 'Modify client settings and profiles' },
  { code: 'clients.archive', module: 'clients', name: 'Archive Clients', description: 'Archive and deactivate client workspaces' },
  { code: 'clients.manage_users', module: 'clients', name: 'Manage Client Users', description: 'Invite, edit, or remove client workspace users' },
  { code: 'clients.manage_settings', module: 'clients', name: 'Manage Client Settings', description: 'Update workspace branding and preferences' },
  { code: 'clients.assign_managers', module: 'clients', name: 'Assign Account Managers', description: 'Assign primary and backup account managers' },
  { code: 'clients.view_audit_logs', module: 'clients', name: 'View Client Audit Logs', description: 'View client operational audit logs' },
  { code: 'users.view', module: 'users', name: 'View Users', description: 'View team members' },
  { code: 'users.create', module: 'users', name: 'Create Users', description: 'Create and invite users' },
  { code: 'users.update', module: 'users', name: 'Update Users', description: 'Modify user accounts and permissions' },
  { code: 'roles.view', module: 'roles', name: 'View Roles', description: 'View system and client roles' },
  { code: 'roles.manage', module: 'roles', name: 'Manage Roles', description: 'Create and edit roles' },
  { code: 'permissions.view', module: 'permissions', name: 'View Permissions', description: 'View system permissions list' },
  { code: 'leads.view', module: 'leads', name: 'View Leads', description: 'View CRM leads' },
  { code: 'leads.create', module: 'leads', name: 'Create Leads', description: 'Create manual leads and import CSV' },
  { code: 'leads.update', module: 'leads', name: 'Update Leads', description: 'Update lead stages, status, and details' },
  { code: 'leads.delete', module: 'leads', name: 'Delete Leads', description: 'Archive or remove leads' },
  { code: 'leads.export', module: 'leads', name: 'Export Leads', description: 'Export leads to CSV' },
  { code: 'leads.assign', module: 'leads', name: 'Assign Leads', description: 'Assign leads to team members' },
  { code: 'leads.manage_pipeline', module: 'leads', name: 'Manage Pipeline', description: 'Update pipeline stages and configuration' },
  { code: 'leads.manage_webhooks', module: 'leads', name: 'Manage Webhooks', description: 'Create, rotate, and manage client lead intake webhooks' },
  { code: 'leads.view_activity', module: 'leads', name: 'View Lead Activity', description: 'Inspect lead history and timeline notes' },
  { code: 'conversations.view', module: 'conversations', name: 'View Conversations', description: 'Access unified inbox messages' },
  { code: 'conversations.create', module: 'conversations', name: 'Create Conversations', description: 'Initiate new conversations' },
  { code: 'conversations.reply', module: 'conversations', name: 'Reply to Conversations', description: 'Send messages and quick replies' },
  { code: 'conversations.assign', module: 'conversations', name: 'Assign Conversations', description: 'Assign conversation threads to team members' },
  { code: 'conversations.manage_status', module: 'conversations', name: 'Manage Conversation Status', description: 'Update conversation status, priority, and tags' },
  { code: 'conversations.manage_providers', module: 'conversations', name: 'Manage Communication Providers', description: 'Configure messaging channels and webhook providers' },
  { code: 'conversations.view_audit', module: 'conversations', name: 'View Conversation Audit History', description: 'Inspect conversation activity event history' },
  { code: 'contacts.view', module: 'contacts', name: 'View Contacts', description: 'Access communication contacts directory' },
  { code: 'contacts.manage', module: 'contacts', name: 'Manage Contacts', description: 'Create and update contacts' },
  { code: 'forms.view', module: 'forms', name: 'View Forms', description: 'Access website lead capture forms and submissions' },
  { code: 'forms.create', module: 'forms', name: 'Create Forms', description: 'Create new website intake forms' },
  { code: 'forms.edit', module: 'forms', name: 'Edit Forms', description: 'Edit form fields, layout, and configuration' },
  { code: 'forms.publish', module: 'forms', name: 'Publish Forms', description: 'Publish, pause, or archive website forms' },
  { code: 'forms.manage_submissions', module: 'forms', name: 'Manage Form Submissions', description: 'Reprocess and manage form submissions' },
  { code: 'forms.view_submissions', module: 'forms', name: 'View Form Submissions', description: 'Inspect submission payloads and events' },
  { code: 'forms.manage_mappings', module: 'forms', name: 'Manage Form Mappings', description: 'Configure CRM Lead and Contact field mappings' },
  { code: 'ads.view', module: 'ads', name: 'View Ad Accounts & Campaigns', description: 'Access connected Meta and Google advertising accounts' },
  { code: 'ads.manage_connections', module: 'ads', name: 'Manage Ad Connections', description: 'Connect, validate, and revoke Meta and Google Ads credentials' },
  { code: 'ads.sync', module: 'ads', name: 'Sync Ad Performance', description: 'Trigger manual and automated ad spend and campaign sync' },
  { code: 'ads.view_reporting', module: 'ads', name: 'View Ad Reporting & ROAS', description: 'Inspect advertising spend, CPL, CPA, and ROAS calculations' },
  { code: 'ads.view_attribution', module: 'ads', name: 'View Ad Attribution', description: 'Inspect multi-touch lead attribution trails' },
  { code: 'tasks.view', module: 'tasks', name: 'View Tasks', description: 'Access task queues, follow-ups, and KPIs' },
  { code: 'tasks.create', module: 'tasks', name: 'Create Tasks', description: 'Create manual tasks and lead follow-ups' },
  { code: 'tasks.edit', module: 'tasks', name: 'Edit Tasks', description: 'Update task details, priority, and due dates' },
  { code: 'tasks.assign', module: 'tasks', name: 'Assign Tasks', description: 'Assign and reassign tasks to team members' },
  { code: 'tasks.complete', module: 'tasks', name: 'Complete Tasks', description: 'Start, complete, snooze, and apply dispositions to tasks' },
  { code: 'tasks.manage_sla', module: 'tasks', name: 'Manage SLA Policies', description: 'Configure workspace SLA response target policies' },
  { code: 'tasks.view_events', module: 'tasks', name: 'View Task Audit History', description: 'Inspect task event history and timeline notes' },
  { code: 'integrations.view', module: 'integrations', name: 'View Integrations', description: 'View connected external marketing accounts' },
  { code: 'integrations.connect', module: 'integrations', name: 'Connect Integrations', description: 'Authenticate and connect external integrations' },
  { code: 'reports.view', module: 'reports', name: 'View Reports', description: 'View performance and marketing analytics reports' },
  { code: 'reports.export', module: 'reports', name: 'Export Reports', description: 'Export analytics and reporting data to CSV' },
  { code: 'reports.manage_saved', module: 'reports', name: 'Manage Saved Reports', description: 'Create, edit, and delete saved report views' },
  { code: 'reports.view_team', module: 'reports', name: 'View Team Productivity', description: 'View team members workload and completed tasks analytics' },
  { code: 'reports.view_financial', module: 'reports', name: 'View Financial Analytics', description: 'View revenue, ad spend, and financial ROAS metrics' },
  { code: 'workflows.view', module: 'workflows', name: 'View Workflows', description: 'View workflow automations and execution history' },
  { code: 'workflows.create', module: 'workflows', name: 'Create Workflows', description: 'Create new workflow automations' },
  { code: 'workflows.edit', module: 'workflows', name: 'Edit Workflows', description: 'Modify workflow triggers, conditions, and actions' },
  { code: 'workflows.delete', module: 'workflows', name: 'Delete Workflows', description: 'Remove workflows from workspace' },
  { code: 'workflows.enable', module: 'workflows', name: 'Enable Workflows', description: 'Toggle workflow active, paused, or archived status' },
  { code: 'workflows.execute', module: 'workflows', name: 'Execute Workflows', description: 'Manually test and execute workflows' },
  { code: 'workflows.view_runs', module: 'workflows', name: 'View Workflow Runs', description: 'Inspect workflow execution audit logs and output' },
  { code: 'notifications.view', module: 'notifications', name: 'View Notifications', description: 'View in-app notifications and unread badges' },
  { code: 'notifications.manage', module: 'notifications', name: 'Manage Notifications', description: 'Mark notifications as read or clear alerts' },
  { code: 'portal.view', module: 'portal', name: 'View Customer Portal', description: 'View customer portal users, invitations, and requests' },
  { code: 'portal.manage', module: 'portal', name: 'Manage Customer Portal', description: 'Invite customers, revoke access, and manage customer requests' },
  { code: 'settings.manage', module: 'settings', name: 'Manage Settings', description: 'Manage platform and workspace settings' },
  { code: 'audit_logs.view', module: 'audit_logs', name: 'View Audit Logs', description: 'View security and action audit trail' },
];

export const seedDatabase = async () => {
  try {
    logger.info('Starting flumenxConectOS bootstrap and permission seeder...');

    // 1. Seed Permissions (Idempotent)
    for (const perm of standardPermissions) {
      await Permission.findOneAndUpdate(
        { code: perm.code },
        { $set: perm },
        { upsert: true, new: true }
      );
    }
    // Remove any legacy permissions removed in previous releases
    await Permission.deleteMany({ code: { $nin: standardPermissions.map((p) => p.code) } });
    logger.info(`[✓] Seeded ${standardPermissions.length} standard system permissions`);

    const allPermissionCodes = standardPermissions.map((p) => p.code);

    // 2. Seed System Roles (Idempotent)
    // Super Admin Role
    const superAdminRole = await Role.findOneAndUpdate(
      { slug: 'super_admin' },
      {
        $set: {
          name: 'Super Admin',
          slug: 'super_admin',
          description: 'FlumenX Super Administrator with unrestricted system access',
          isSystem: true,
          permissionCodes: allPermissionCodes,
        },
      },
      { upsert: true, new: true }
    );

    // Client Admin Role
    const clientAdminCodes = [
      'dashboard.view',
      'clients.view',
      'clients.update',
      'clients.manage_users',
      'clients.manage_settings',
      'users.view',
      'users.create',
      'users.update',
      'leads.view',
      'leads.create',
      'leads.update',
      'leads.delete',
      'leads.export',
      'leads.assign',
      'leads.manage_pipeline',
      'leads.manage_webhooks',
      'leads.view_activity',
      'conversations.view',
      'conversations.create',
      'conversations.reply',
      'conversations.assign',
      'conversations.manage_status',
      'conversations.manage_providers',
      'conversations.view_audit',
      'contacts.view',
      'contacts.manage',
      'forms.view',
      'forms.create',
      'forms.edit',
      'forms.publish',
      'forms.manage_submissions',
      'forms.view_submissions',
      'forms.manage_mappings',
      'ads.view',
      'ads.manage_connections',
      'ads.sync',
      'ads.view_reporting',
      'ads.view_attribution',
      'tasks.view',
      'tasks.create',
      'tasks.edit',
      'tasks.assign',
      'tasks.complete',
      'tasks.manage_sla',
      'tasks.view_events',
      'integrations.view',
      'integrations.connect',
      'reports.view',
      'reports.export',
      'reports.manage_saved',
      'reports.view_team',
      'workflows.view',
      'workflows.create',
      'workflows.edit',
      'workflows.delete',
      'workflows.enable',
      'workflows.execute',
      'workflows.view_runs',
      'notifications.view',
      'notifications.manage',
      'portal.view',
      'portal.manage',
      'settings.manage',
    ];

    const clientAdminRole = await Role.findOneAndUpdate(
      { slug: 'client_admin' },
      {
        $set: {
          name: 'Client Admin',
          slug: 'client_admin',
          description: 'Client administrator managing own company workspace',
          isSystem: true,
          permissionCodes: clientAdminCodes,
        },
      },
      { upsert: true, new: true }
    );

    // Client Staff Role
    const clientStaffCodes = [
      'dashboard.view',
      'leads.view',
      'leads.create',
      'leads.update',
      'leads.view_activity',
      'conversations.view',
      'conversations.create',
      'conversations.reply',
      'conversations.view_audit',
      'contacts.view',
      'forms.view',
      'forms.view_submissions',
      'ads.view',
      'ads.view_reporting',
      'ads.view_attribution',
      'tasks.view',
      'tasks.create',
      'tasks.edit',
      'tasks.complete',
      'tasks.view_events',
      'reports.view',
      'workflows.view',
      'workflows.view_runs',
      'notifications.view',
      'portal.view',
    ];

    const clientStaffRole = await Role.findOneAndUpdate(
      { slug: 'client_staff' },
      {
        $set: {
          name: 'Client Staff',
          slug: 'client_staff',
          description: 'Client staff handling leads and customer communications',
          isSystem: true,
          permissionCodes: clientStaffCodes,
        },
      },
      { upsert: true, new: true }
    );

    logger.info('[✓] Seeded system roles: super_admin, client_admin, client_staff');

    // 3. Seed Initial Super Admin (Idempotent)
    const adminEmail = env.INITIAL_ADMIN_EMAIL.toLowerCase().trim();
    let superAdmin = await User.findOne({ email: adminEmail }).select('+passwordHash');

    if (!superAdmin) {
      const passwordHash = await bcrypt.hash(env.INITIAL_ADMIN_PASSWORD, 10);
      superAdmin = await User.create({
        name: env.INITIAL_ADMIN_NAME,
        email: adminEmail,
        passwordHash,
        isSuperAdmin: true,
        status: 'active',
        mustChangePassword: true,
      });

      await AuditService.log({
        userId: superAdmin._id,
        userEmail: superAdmin.email,
        action: 'auth.bootstrap.super_admin_created',
        resourceType: 'user',
        resourceId: superAdmin._id.toString(),
        success: true,
        metadata: { email: adminEmail },
      });

      logger.info(`[✓] Created Initial Super Admin: ${adminEmail} (password rotation required)`);
    } else {
      // Update password hash to rotated initial admin password
      superAdmin.passwordHash = await bcrypt.hash(env.INITIAL_ADMIN_PASSWORD, 10);
      superAdmin.isSuperAdmin = true;
      superAdmin.status = 'active';
      superAdmin.mustChangePassword = true;
      await superAdmin.save();
      logger.info(`[i] Super Admin verified & credentials synchronized: ${adminEmail}`);
    }

    // 4. Seed Initial Sample Client (Acme Digital Media) for Development Testing
    let client = await Client.findOne({ slug: 'acme-digital-media' });
    if (!client) {
      client = await Client.create({
        name: 'Acme Digital Media',
        slug: 'acme-digital-media',
        email: 'contact@acmedigital.com',
        phone: '+1 555-0199',
        industry: 'E-commerce & Retail',
        timezone: 'America/New_York',
        currency: 'USD',
        status: 'active',
        health: 'Healthy',
        primaryAccountManagerId: superAdmin._id,
      });
      logger.info(`[✓] Created sample client workspace: ${client.name} (${client._id})`);
    }

    // 5. Seed Client Admin User for Acme Digital Media
    const clientAdminEmail = 'manager@acmedigital.com';
    let clientAdminUser = await User.findOne({ email: clientAdminEmail }).select('+passwordHash');
    if (!clientAdminUser) {
      const clientAdminPasswordHash = await bcrypt.hash(env.INITIAL_ADMIN_PASSWORD, 10);
      clientAdminUser = await User.create({
        name: 'Sarah Jenkins (Acme Admin)',
        email: clientAdminEmail,
        passwordHash: clientAdminPasswordHash,
        isSuperAdmin: false,
        status: 'active',
        mustChangePassword: true,
      });
      logger.info(`[✓] Created sample client admin user: ${clientAdminEmail}`);
    } else {
      clientAdminUser.passwordHash = await bcrypt.hash(env.INITIAL_ADMIN_PASSWORD, 10);
      clientAdminUser.status = 'active';
      await clientAdminUser.save();
      logger.info(`[i] Sample Client Admin credentials synchronized: ${clientAdminEmail}`);
    }

    // Link Client Admin to Acme Digital Media in ClientMembership
    await ClientMembership.findOneAndUpdate(
      { clientId: client._id, userId: clientAdminUser._id },
      {
        $set: {
          clientId: client._id,
          userId: clientAdminUser._id,
          roleId: clientAdminRole._id,
          status: 'active',
          joinedAt: new Date(),
        },
      },
      { upsert: true, new: true }
    );
    logger.info(`[✓] Assigned ${clientAdminEmail} as client_admin for ${client.name}`);

    logger.info('==================================================');
    logger.info('flumenxConectOS bootstrap completed successfully!');
    logger.info(`Super Admin account active: ${adminEmail} (Credentials configured in environment)`);
    logger.info(`Sample Client Admin account active: ${clientAdminEmail}`);
    logger.info('==================================================');
  } catch (error) {
    logger.error('Error during database bootstrap:', error);
    throw error;
  }
};

// If run directly from CLI
if (require.main === module) {
  (async () => {
    await connectDatabase();
    await seedDatabase();
    await disconnectDatabase();
    process.exit(0);
  })();
}
