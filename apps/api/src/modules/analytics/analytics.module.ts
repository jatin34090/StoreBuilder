import { Module } from '@nestjs/common';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { AnalyticsProcessor } from './analytics.processor';
import { SuperAdminAnalyticsController } from './super-admin-analytics.controller';
import { SuperAdminAnalyticsService } from './super-admin-analytics.service';
import { QueuesModule } from '../queues/queue.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [QueuesModule, NotificationsModule],
  controllers: [AnalyticsController, SuperAdminAnalyticsController],
  providers: [AnalyticsService, SuperAdminAnalyticsService, AnalyticsProcessor],
})
export class AnalyticsModule {}
