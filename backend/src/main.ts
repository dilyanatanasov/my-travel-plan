import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { json, raw, urlencoded } from 'express';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';

async function bootstrap() {
  // Fail fast rather than signing tokens with `undefined`, which would make
  // every token forgeable.
  if (!process.env.JWT_SECRET) {
    throw new Error(
      'JWT_SECRET is not set. Generate one with `openssl rand -base64 48` and add it to .env',
    );
  }

  // Own the body parser rather than taking Nest's 100 kb default. The largest
  // legitimate request is a flight import (capped at 1000 journeys in its DTO),
  // which fits comfortably under 1 MB; anything larger is a mistake or an
  // attack and is rejected before it reaches a handler. nginx caps the body at
  // 10 MB one layer out — this is the tighter, app-aware limit inside it.
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  // The share card arrives as a raw PNG, not JSON — scoped to its one route
  // (path as seen on the wire, so with the /api prefix) and to image/png, so
  // no other endpoint grows a binary body by accident. Same 1 MB ceiling.
  app.use('/api/share/card', raw({ type: 'image/png', limit: '1mb' }));
  app.use(json({ limit: '1mb' }));
  app.use(urlencoded({ extended: true, limit: '1mb' }));

  app.setGlobalPrefix('api');

  // Security headers. contentSecurityPolicy is off because this process only
  // serves JSON — nginx sets the document policy for the pages that need one.
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: { policy: 'same-site' },
    }),
  );

  app.use(cookieParser());

  // One error shape for every failure, and no stack traces or SQL on the wire.
  app.useGlobalFilters(new GlobalExceptionFilter());

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
