import { Router } from 'express';
import * as printerController from '../../controllers/printerController';
import { authenticate, requireBusinessAccess } from '../../middleware/auth';

const router = Router();

router.use(authenticate);
router.use(requireBusinessAccess());

router.get('/', printerController.getPrinters);
router.post('/', printerController.createPrinter);
router.put('/:id', printerController.updatePrinter);
router.delete('/:id', printerController.deletePrinter);

export default router;
