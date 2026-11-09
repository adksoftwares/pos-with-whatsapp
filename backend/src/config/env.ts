import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('5000'),
  DATABASE_URL: z.string(),
  JWT_SECRET: z.string().min(10),
  JWT_EXPIRES_IN: z.string().default('7d'),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  WHATSAPP_ACCESS_TOKEN: z.string().optional(),
  WHATSAPP_PHONE_NUMBER_ID: z.string().optional(),
  WHATSAPP_API_VERSION: z.string().default('v21.0'),
});

const _env = envSchema.safeParse(process.env);

if (!_env.success) {
  console.error('❌ Invalid environment variables:', _env.error.format());
  throw new Error('Invalid environment variables');
}

export const env = _env.data;
