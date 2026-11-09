import { Router } from 'express';
import { getSettings, updateSettings, getBusinessUsers, updateUserRole } from '../../controllers/settingsController';
import { authenticate, requireBusinessAccess } from '../../middleware/auth';

const router = Router();

router.use(authenticate);

// Settings (any role can read; write restricted to OWNER/ADMIN in controller)
router.get('/', requireBusinessAccess(), getSettings);
router.patch('/', requireBusinessAccess(['OWNER', 'ADMIN']), updateSettings);

// User Management (OWNER/ADMIN to modify, MANAGER to read — enforced in controller)
router.get('/users', requireBusinessAccess(['OWNER', 'ADMIN', 'MANAGER']), getBusinessUsers);
router.patch('/users', requireBusinessAccess(['OWNER', 'ADMIN']), updateUserRole);

export default router;
