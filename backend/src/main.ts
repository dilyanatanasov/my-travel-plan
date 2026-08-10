import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';

async function bootstrap() {
  // Fail fast rather than signing tokens with `undefined`, which would make
  // every token forgeable.
  if (!process.env.JWT_SECRET) {
    throw new Error(
      'JWT_SECRET is not set. Generate one with `openssl rand -base64 48` and add it to .env',
    );
  }

  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api');

  app.use(cookieParser());

  // An explicit allowlist, not `origin: true`. Reflecting arbitrary origins
  // alongside credentials would let any site drive this API as the logged-in user.
  const allowedOrigins = (
    process.env.CORS_ORIGIN || 'http://localhost:5173'
  )
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  const port = process.env.API_PORT || 3000;
  await app.listen(port);
  Logger.log(`Application is running on: http://localhost:${port}`, 'Bootstrap');
  Logger.log(`CORS allowed origins: ${allowedOrigins.join(', ')}`, 'Bootstrap');
}
bootstrap();
