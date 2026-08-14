import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { BillingController } from './billing.controller';
import { BillingAdminController } from './billing-admin.controller';
import { BillingCronService } from './billing-cron.service';
import { BillingService } from './billing.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [PrismaModule, NotificationsModule, ScheduleModule.forRoot()],
  controllers: [BillingController, BillingAdminController],
  providers: [BillingService, BillingCronService],
  exports: [BillingService],
})
export class BillingModule {}
