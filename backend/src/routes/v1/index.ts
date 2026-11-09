import { Router } from 'express';
import authRoutes from './authRoutes';
import categoryRoutes from './categoryRoutes';
import productRoutes from './productRoutes';
import orderRoutes from './orderRoutes';
import printerRoutes from './printerRoutes';
import reportRoutes from './reportRoutes';
import dashboardRoutes from './dashboardRoutes';
import syncRoutes from './syncRoutes';
import settingsRoutes from './settingsRoutes';
import subscriptionRoutes from './subscriptionRoutes';
import healthRoutes from './healthRoutes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/categories', categoryRoutes);
router.use('/products', productRoutes);
router.use('/orders', orderRoutes);
router.use('/printers', printerRoutes);
router.use('/reports', reportRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/sync', syncRoutes);
router.use('/settings', settingsRoutes);
router.use('/subscription', subscriptionRoutes);
router.use('/health', healthRoutes);

export default router;
