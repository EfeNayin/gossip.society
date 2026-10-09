import { z } from 'zod';

try {
  process.loadEnvFile();
} catch {
  // No .env file (e.g. CI, production): rely on the real environment.
}

const envSchema = z.object({
  PORT: z.coerce.number().int().default(3000),
  DATABASE_URL: z.url(),
  CORS_ORIGINS: z
    .string()
    .default('http://localhost:3001,http://localhost:8081')
    .transform((value) => value.split(',').map((origin) => origin.trim())),
});

export const env = envSchema.parse(process.env);
