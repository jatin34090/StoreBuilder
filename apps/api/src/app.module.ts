import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
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
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: configValidationSchema,
      validationOptions: { allowUnknown: false, abortEarly: false },
    }),

    ThrottlerModule.forRoot([
      { name: 'global', ttl: 60_000, limit: 100 },
    ]),

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
  ],
  providers: [
    // Order matters: throttling runs first, then authn, then authz.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
