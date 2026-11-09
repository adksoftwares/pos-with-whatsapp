import { Router } from 'express';
import * as reportController from '../../controllers/reportController';
import { authenticate, requireBusinessAccess } from '../../middleware/auth';

const router = Router();

router.use(authenticate);
// Most reports are for Managers and above
router.use(requireBusinessAccess(['OWNER', 'ADMIN', 'MANAGER']));

router.get('/sales-summary', reportController.getSalesSummary);
router.get('/payment-methods', reportController.getPaymentMethodsReport);
router.get('/products', reportController.getProductAnalytics);
router.get('/sales-by-date', reportController.getSalesByDate);

export default router;
