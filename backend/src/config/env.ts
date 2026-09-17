import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  PORT: z.string().default('5000').transform((val) => parseInt(val, 10)),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  MONGODB_URI: z.string().default('mongodb://localhost:27017/flumenx_conect_os'),
  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 characters long'),
  JWT_EXPIRES_IN: z.string().default('7d'),
  ENCRYPTION_SECRET_KEY: z.string().min(32, 'ENCRYPTION_SECRET_KEY must be at least 32 characters long'),
  CORS_ORIGIN: z.string().default('http://localhost:3000'),
  INITIAL_ADMIN_NAME: z.string().default('FlumenX Super Admin'),
  INITIAL_ADMIN_EMAIL: z.string().email().default('admin@flumenx.com'),
  INITIAL_ADMIN_PASSWORD: z.string().min(8, 'INITIAL_ADMIN_PASSWORD must be configured and at least 8 characters'),
  APP_URL: z.string().default('http://localhost:3000'),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.string().optional().transform((val) => (val ? parseInt(val, 10) : undefined)),
  SMTP_SECURE: z.string().optional().transform((val) => val === 'true'),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().optional(),
});

const parseEnv = () => {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    console.error('Invalid environment variables configured:');
    console.error(JSON.stringify(result.error.format(), null, 2));
    process.exit(1);
  }
  return result.data;
};

export const env = parseEnv();
export type Env = z.infer<typeof envSchema>;
