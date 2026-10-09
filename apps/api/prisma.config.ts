import { defineConfig } from 'prisma/config';

try {
  process.loadEnvFile();
} catch {
  // No .env file (e.g. CI): rely on the real environment.
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: process.env.DATABASE_URL ?? '',
  },
});
