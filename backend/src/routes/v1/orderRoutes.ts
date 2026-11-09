import { Router } from 'express';
import * as orderController from '../../controllers/orderController';
import { authenticate, requireBusinessAccess } from '../../middleware/auth';

const router = Router();

router.use(authenticate);
router.use(requireBusinessAccess());

router.get('/', orderController.getOrders);
router.post('/preview', orderController.previewOrder);
router.post('/', orderController.createOrder);
router.get('/:id/receipt', orderController.getReceipt);

export default router;
