import { Module, MiddlewareConsumer, NestModule, RequestMethod } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bull';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { configValidationSchema } from './config/config.schema';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { HealthModule } from './modules/health/health.module';
import { UsersModule } from './modules/users/users.module';
import { CategoriesModule } from './modules/categories/categories.module';
import { ProductsModule } from './modules/products/products.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { CouponsModule } from './modules/coupons/coupons.module';
import { UploadModule } from './modules/upload/upload.module';
import { OrdersModule } from './modules/orders/orders.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { SearchModule } from './modules/search/search.module';
import { ReviewsModule } from './modules/reviews/reviews.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { DeliveryModule } from './modules/delivery/delivery.module';
import { CartModule } from './modules/cart/cart.module';
import { WishlistModule } from './modules/wishlist/wishlist.module';
import { SettingsModule } from './modules/settings/settings.module';
import { TenantModule } from './modules/tenant/tenant.module';
import { StoresModule } from './modules/stores/stores.module';
import { BillingModule } from './modules/billing/billing.module';
import { EventsModule } from './modules/events/events.module';
import { QueuesModule } from './modules/queues/queue.module';
import { OnboardingModule } from './modules/onboarding/onboarding.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { TenantRateLimitGuard } from './common/guards/tenant-rate-limit.guard';
import { PermissionGuard } from './common/guards/permission.guard';
import { FeatureGuard } from './common/guards/feature.guard';
import { TenantMiddleware } from './common/middleware/tenant.middleware';
import { TenantApiLogInterceptor } from './common/interceptors/tenant-api-log.interceptor';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: configValidationSchema,
      validationOptions: { allowUnknown: false, abortEarly: false },
    }),

    // Bull queue Redis connection — shared by all queues in QueuesModule
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const redisUrl = config.get<string>('REDIS_URL', '');
        const redisOpts = {
          // Don't block app startup if Redis is unreachable in dev
          enableOfflineQueue: false,
          connectTimeout: 2000,
          maxRetriesPerRequest: 0,
          lazyConnect: true,
        };
        if (!redisUrl || redisUrl.includes('[password]') || redisUrl === 'memory') {
          return { redis: { host: 'localhost', port: 6379, ...redisOpts } };
        }
        return { url: redisUrl, redis: redisOpts };
      },
    }),

    // Global throttler — last line of defense before per-tenant limiting
    ThrottlerModule.forRoot([
      { name: 'global', ttl: 60_000, limit: 500 },
    ]),

    // TenantModule is @Global — no need to import elsewhere
    TenantModule,

    PrismaModule,
    AuthModule,
    HealthModule,
    UsersModule,
    CategoriesModule,
    ProductsModule,
    InventoryModule,
    CouponsModule,
    UploadModule,
    OrdersModule,
    PaymentsModule,
    SearchModule,
    ReviewsModule,
    NotificationsModule,
    AnalyticsModule,
    DeliveryModule,
    CartModule,
    WishlistModule,
    SettingsModule,
    StoresModule,
    BillingModule,
    EventsModule,
    QueuesModule,
    OnboardingModule,
  ],
  providers: [
    // Guard order: platform throttle → JWT authn → per-tenant rate limit → role authz → permission authz
    { provide: APP_GUARD,       useClass: ThrottlerGuard },
    { provide: APP_GUARD,       useClass: JwtAuthGuard },
    { provide: APP_GUARD,       useClass: TenantRateLimitGuard },
    { provide: APP_GUARD,       useClass: RolesGuard },
    { provide: APP_GUARD,       useClass: PermissionGuard },
    { provide: APP_GUARD,       useClass: FeatureGuard },
    // Log every request with tenant context (fire-and-forget)
    { provide: APP_INTERCEPTOR, useClass: TenantApiLogInterceptor },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // Resolve tenant on every incoming request before guards run
    consumer
      .apply(TenantMiddleware)
      .forRoutes({ path: '*', method: RequestMethod.ALL });
  }
}
