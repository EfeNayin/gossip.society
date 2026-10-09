import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { env } from './env.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({ origin: env.CORS_ORIGINS });
  // 0.0.0.0 so a phone on the same network (Expo Go) can reach the API.
  await app.listen(env.PORT, '0.0.0.0');
}
await bootstrap();
