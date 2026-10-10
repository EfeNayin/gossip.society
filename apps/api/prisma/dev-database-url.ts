import { z } from 'zod';

// The dev scripts only need the database, so they don't load the full API
// env (which requires auth settings such as JWT_SECRET).
try {
  process.loadEnvFile();
} catch {
  // No .env file: rely on the real environment.
}

export const databaseUrl = z.url().parse(process.env.DATABASE_URL);
