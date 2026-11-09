import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { env } from './config/env';
import routesV1 from './routes/v1';
import { errorHandler } from './middleware/errorHandler';
import { ApiError } from './core/ApiError';

const app = express();

// ── Security headers ─────────────────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: env.NODE_ENV === 'production' ? undefined : false,
}));

// ── CORS ─────────────────────────────────────────────────────────────────────
app.use(cors({
  origin: env.CORS_ORIGIN,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Business-Id', 'X-Idempotency-Key'],
}));

// ── Body parsing with size limits (protect against request-body DoS) ─────────
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

// ── HTTP logging ──────────────────────────────────────────────────────────────
if (env.NODE_ENV !== 'test') {
  app.use(morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev'));
}

// ── Global rate limit (all routes) ──────────────────────────────────────────
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Too many requests, please try again later.' } },
});
app.use(globalLimiter);

// ── Strict rate limit for auth routes (brute-force protection) ───────────────
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // 20 login attempts per 15 min per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: { code: 'AUTH_RATE_LIMIT_EXCEEDED', message: 'Too many authentication attempts. Please try again in 15 minutes.' } },
  skip: (req) => env.NODE_ENV === 'test',
});
app.use('/api/v1/auth', authLimiter);

// ── API Routes ────────────────────────────────────────────────────────────────
app.use('/api/v1', routesV1);

// ── Handle unknown routes ─────────────────────────────────────────────────────
app.use((req, res, next) => {
  next(ApiError.notFound(`Route ${req.originalUrl} not found`));
});

// ── Global Error Handler ──────────────────────────────────────────────────────
app.use(errorHandler);

export default app;
