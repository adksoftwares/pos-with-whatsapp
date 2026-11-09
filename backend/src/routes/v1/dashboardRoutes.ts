import { Router } from 'express';
import * as dashboardController from '../../controllers/dashboardController';
import { authenticate, requireBusinessAccess } from '../../middleware/auth';

const router = Router();

router.use(authenticate);
router.use(requireBusinessAccess());

router.get('/summary', dashboardController.getDashboardSummary);
router.get('/recent-sales', dashboardController.getDashboardRecentSales);
router.get('/low-stock', dashboardController.getDashboardLowStock);

export default router;
