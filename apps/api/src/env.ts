import { z } from 'zod';

try {
  process.loadEnvFile();
} catch {
  // No .env file (e.g. CI, production): rely on the real environment.
}

const envSchema = z
  .object({
    PORT: z.coerce.number().int().default(3000),
    DATABASE_URL: z.url(),
    CORS_ORIGINS: z
      .string()
      .default('http://localhost:3001,http://localhost:8081')
      .transform((value) => value.split(',').map((origin) => origin.trim())),
    // No default on purpose: a missing secret must stop the API at startup.
    JWT_SECRET: z
      .string({ error: 'JWT_SECRET is required' })
      .min(32, 'JWT_SECRET must be at least 32 characters'),
    JWT_ACCESS_TTL_SECONDS: z.coerce.number().int().positive().default(900),
    LOGIN_RATE_LIMIT: z.coerce.number().int().positive().default(10),
    LOGIN_RATE_WINDOW_SECONDS: z.coerce.number().int().positive().default(60),
    // Absolute session length: refreshing never extends it (default 7 days).
    SESSION_TTL_SECONDS: z.coerce.number().int().positive().default(604800),
    REFRESH_RATE_LIMIT: z.coerce.number().int().positive().default(20),
    REFRESH_RATE_WINDOW_SECONDS: z.coerce.number().int().positive().default(60),
  })
  .refine((env) => env.SESSION_TTL_SECONDS >= env.JWT_ACCESS_TTL_SECONDS, {
    path: ['SESSION_TTL_SECONDS'],
    message:
      'SESSION_TTL_SECONDS must not be shorter than JWT_ACCESS_TTL_SECONDS',
  });

export function parseEnv(source: NodeJS.ProcessEnv) {
  return envSchema.parse(source);
}

export const env = parseEnv(process.env);
