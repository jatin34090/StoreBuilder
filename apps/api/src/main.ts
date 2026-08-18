import { NestFactory } from '@nestjs/core';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { randomUUID } from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { initErrorTracking } from './common/monitoring/error-tracker';

// BigInt → number serialization: Prisma returns BigInt for certain columns
// (e.g. storageBytes). Express JSON serializer throws by default — patch globally.
(BigInt.prototype as unknown as { toJSON: () => number }).toJSON = function () {
  return Number(this);
};

async function bootstrap() {
  // Initialise optional error tracking (Sentry) before the app starts.
  initErrorTracking();
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log', 'debug'],
    // Required for Razorpay webhook HMAC verification — stores raw body at req.rawBody
    rawBody: true,
  });

  const configService = app.get(ConfigService);
  const nodeEnv = configService.get<string>('NODE_ENV', 'development');
  const port = configService.get<number>('PORT', 3001);
  const corsOrigins = configService.get<string>('CORS_ORIGINS', 'http://localhost:3000');

  // Request ID — generate or forward X-Request-ID for log correlation
  app.use((req: Request, res: Response, next: NextFunction) => {
    const id = (req.headers['x-request-id'] as string | undefined)?.slice(0, 64) || randomUUID();
    (req as Request & { requestId: string }).requestId = id;
    res.setHeader('X-Request-ID', id);
    next();
  });

  // Security
  app.use(helmet());
  app.enableCors({
    origin: corsOrigins.split(',').map((o) => o.trim()),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    // x-store-id is NOT in allowedHeaders — browsers must go through Next.js middleware
    // which resolves storeId from subdomain/path (never trusts raw client header).
    // Server-to-server requests (Next.js → API) still set it via requestHeaders.set().
    allowedHeaders: ['Content-Type', 'Authorization', 'x-razorpay-signature', 'x-store-slug', 'x-request-id'],
    exposedHeaders: ['X-Request-ID'],
  });

  // Cookie parsing
  app.use(cookieParser());

  // Global prefix
  app.setGlobalPrefix('api/v1');

  // URI versioning
  app.enableVersioning({ type: VersioningType.URI });

  // Global pipes — strip unknown fields, validate all DTOs
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // Global interceptors & filters
  app.useGlobalInterceptors(new ResponseInterceptor());
  app.useGlobalFilters(new AllExceptionsFilter());

  // Swagger (dev only)
  if (nodeEnv !== 'production') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('StoreBuilder Platform API')
      .setDescription('Complete REST API for the multi-tenant ecommerce SaaS platform')
      .setVersion('1.0')
      .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'access-token')
      .addCookieAuth('refresh_token')
      .addTag('Auth')
      .addTag('Users')
      .addTag('Categories')
      .addTag('Products')
      .addTag('Inventory')
      .addTag('Cart')
      .addTag('Wishlist')
      .addTag('Orders')
      .addTag('Payments')
      .addTag('Delivery')
      .addTag('Coupons')
      .addTag('Reviews')
      .addTag('Notifications')
      .addTag('Analytics')
      .addTag('Upload')
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, document, {
      swaggerOptions: { persistAuthorization: true },
    });
  }

  // Graceful shutdown — drain in-flight requests and close DB/Redis cleanly on SIGTERM/SIGINT
  app.enableShutdownHooks();

  await app.listen(port);
  console.log(`API running on http://localhost:${port}/api/v1`);
  if (nodeEnv !== 'production') {
    console.log(`Swagger docs at http://localhost:${port}/api/docs`);
  }
}

bootstrap().catch(console.error);
