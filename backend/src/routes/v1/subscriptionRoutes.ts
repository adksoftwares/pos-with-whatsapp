import { Router } from 'express';
import { authenticate, requireBusinessAccess, requireSuperAdmin } from '../../middleware/auth';
import {
  getMySubscription,
  getPlans,
  getSubscriptionHistory,
  adminListSubscriptions,
  adminGetBusinessSubscription,
  adminActivatePro,
  adminReactivatePro,
  adminCancelSubscription,
} from '../../controllers/subscriptionController';

const router = Router();

router.use(authenticate);

// ── Business-facing routes (require X-Business-Id) ────────────────────────────
router.get('/', requireBusinessAccess(), getMySubscription);
router.get('/plans', requireBusinessAccess(), getPlans);
router.get('/history', requireBusinessAccess(), getSubscriptionHistory);

// ── Super Admin routes (platform-level, no business context required) ─────────
// These MUST come before /:businessId to avoid route collision
router.get('/admin/all', requireSuperAdmin, adminListSubscriptions);
router.get('/admin/:businessId', requireSuperAdmin, adminGetBusinessSubscription);
router.post('/admin/:businessId/activate', requireSuperAdmin, adminActivatePro);
router.post('/admin/:businessId/reactivate', requireSuperAdmin, adminReactivatePro);
router.post('/admin/:businessId/cancel', requireSuperAdmin, adminCancelSubscription);

export default router;
