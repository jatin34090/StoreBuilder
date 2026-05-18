import { Test, type TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { ResponseInterceptor } from '../src/common/interceptors/response.interceptor';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import * as cookieParser from 'cookie-parser';

describe('Auth (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.useGlobalInterceptors(new ResponseInterceptor());
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /api/v1/auth/send-otp', () => {
    it('should reject invalid phone number', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/send-otp')
        .send({ phone: '12345' })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should accept valid Indian phone number', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/send-otp')
        .send({ phone: '9876543210' });

      // Will fail in test env (no MSG91) but validates DTO
      expect([200, 500]).toContain(response.status);
    });
  });

  describe('POST /api/v1/auth/login', () => {
    it('should reject invalid credentials', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: 'nobody@test.com', password: 'wrongpassword' })
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    it('should reject malformed email', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: 'not-an-email', password: 'password' })
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });
});
