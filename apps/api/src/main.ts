import { NestFactory } from '@nestjs/core';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log', 'debug'],
    // Required for Razorpay webhook HMAC verification — stores raw body at req.rawBody
    rawBody: true,
  });

  const configService = app.get(ConfigService);
  const nodeEnv = configService.get<string>('NODE_ENV', 'development');
  const port = configService.get<number>('PORT', 3001);
  const corsOrigins = configService.get<string>('CORS_ORIGINS', 'http://localhost:3000');

  // Security
  app.use(helmet());
  app.enableCors({
    origin: corsOrigins.split(',').map((o) => o.trim()),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-razorpay-signature'],
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
      .setTitle('Jewellery Platform API')
      .setDescription('Complete REST API for the B2C artificial jewellery platform')
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

  await app.listen(port);
  console.log(`🚀 API running on http://localhost:${port}/api/v1`);
  if (nodeEnv !== 'production') {
    console.log(`📚 Swagger docs at http://localhost:${port}/api/docs`);
  }
}

bootstrap().catch(console.error);
