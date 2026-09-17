# flumenxConectOS — Reporting Permissions & RBAC Matrix

## Reporting Permission Codes

Release 9 defines exactly 5 reporting permissions in the system permission registry:

| Code | Module | Display Name | Description |
| :--- | :--- | :--- | :--- |
| `reports.view` | `reports` | View Reports | Access dashboard, lead, form, task, and conversation analytics |
| `reports.export` | `reports` | Export Reports | Export performance and lead analytics data to CSV |
| `reports.manage_saved` | `reports` | Manage Saved Reports | Create, update, and delete workspace and private saved views |
| `reports.view_team` | `reports` | View Team Productivity | View individual team member workload, task volume, and SLA breaches |
| `reports.view_financial` | `reports` | View Financial Analytics | View ad spend, deal revenue, and ROAS calculations |

---

## Role Assignment Matrix

| Permission Code | `super_admin` | `client_admin` | `client_staff` | Custom Workspace Roles |
| :--- | :---: | :---: | :---: | :---: |
| `reports.view` | ✅ | ✅ | ✅ | Optional |
| `reports.export` | ✅ | ✅ | ❌ | Optional |
| `reports.manage_saved` | ✅ | ✅ | ❌ | Optional |
| `reports.view_team` | ✅ | ✅ | ❌ | Optional |
| `reports.view_financial` | ✅ | ❌ | ❌ | Explicitly Granted Only |

### Total Standard Permissions Count: 61
- 9 Workspace & Client permissions
- 6 User, Role & Permission permissions
- 9 Lead CRM permissions
- 7 Conversation permissions
- 2 Contact permissions
- 7 Website Form permissions
- 5 Ad Platform permissions
- 7 Task & SLA permissions
- 2 Integration permissions
- 5 Reporting permissions (`reports.view`, `reports.export`, `reports.manage_saved`, `reports.view_team`, `reports.view_financial`)
- 1 Settings permission
- 1 Audit log permission

---

## Service & Controller Level Enforcement

Financial security is enforced strictly at the controller and database aggregation level:
1. **Controller Layer**:
   ```typescript
   public static async hasFinancialAccess(req: Request, clientId: string): Promise<boolean> {
     if (req.user?.isSuperAdmin) return true;
     const membership = await ClientMembership.findOne({
       userId: req.user!._id,
       clientId,
       status: 'active',
     }).populate('roleId', 'permissionCodes');

     if (!membership) return false;
     const role = membership.roleId as any;
     const effectivePermissions = new Set([
       ...(role?.permissionCodes || []),
       ...(membership.customPermissions || []),
     ]);
     return effectivePermissions.has('reports.view_financial');
   }
   ```
2. **Service Layer**:
   - In `getOverviewKpis`: If `hasFinancialAccess` is false, `totalSpend`, `closedRevenue`, and `roas` are completely excluded from the JSON payload.
   - In `getLeadAnalytics`: If `hasFinancialAccess` is false, pipeline `totalValue` is omitted from stage records.
   - In `getCampaignAnalytics`: If `hasFinancialAccess` is false, `spend`, `cpc`, and `cpl` are stripped from campaign objects.
   - In `exportReportCsv`: If `hasFinancialAccess` is false, `Spend`, `CTR %`, `CPC`, and `CPL` columns and values are excluded from the exported CSV.
