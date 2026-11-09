import { Router } from 'express';

const router = Router();

/**
 * GET /api/v1/health
 * Health check endpoint — safe for load balancers and uptime monitors.
 * Does NOT expose credentials, environment variables, or internal configuration.
 */
router.get('/', (req, res) => {
  res.status(200).json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    service: 'ADK POS API',
  });
});

export default router;
