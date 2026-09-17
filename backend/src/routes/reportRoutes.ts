import { Router } from 'express';
import { ReportController } from '../controllers/reportController';
import { requireAuth } from '../middleware/authMiddleware';
import { requirePermission } from '../middleware/permissionMiddleware';

const router = Router();

// Base protection: require active user session
router.use(requireAuth);

// 1. Overview KPIs
router.get('/overview', requirePermission('reports.view'), ReportController.getOverview);

// 2. Specialized Analytics
router.get('/leads', requirePermission('reports.view'), ReportController.getLeads);
router.get('/campaigns', requirePermission('reports.view'), ReportController.getCampaigns);
router.get('/forms', requirePermission('reports.view'), ReportController.getForms);
router.get('/tasks', requirePermission('reports.view'), ReportController.getTasks);
router.get('/team', requirePermission('reports.view_team'), ReportController.getTeamProductivity);
router.get('/conversations', requirePermission('reports.view'), ReportController.getConversations);

// 3. Export
router.get('/export', requirePermission('reports.export'), ReportController.exportCsv);

// 4. Saved Reports CRUD
router.get('/saved', requirePermission('reports.view'), ReportController.listSavedReports);
router.post('/saved', requirePermission('reports.manage_saved'), ReportController.createSavedReport);
router.get('/saved/:id', requirePermission('reports.view'), ReportController.getSavedReport);
router.patch('/saved/:id', requirePermission('reports.manage_saved'), ReportController.updateSavedReport);
router.delete('/saved/:id', requirePermission('reports.manage_saved'), ReportController.deleteSavedReport);

export default router;
