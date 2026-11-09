import { Router } from 'express';
import * as syncController from '../../controllers/syncController';
import { authenticate, requireBusinessAccess } from '../../middleware/auth';

const router = Router();

router.use(authenticate);
router.use(requireBusinessAccess());

router.post('/orders', syncController.syncOfflineOrder);

export default router;
