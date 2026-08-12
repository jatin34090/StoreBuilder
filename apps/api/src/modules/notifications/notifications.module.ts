import { Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { NotificationsProcessor } from './notifications.processor';
import { RedisService } from './redis.service';
import { QueuesModule } from '../queues/queue.module';
import { IsolatedQueueService } from '../queues/isolated-queue.service';

@Module({
  imports: [QueuesModule],
  controllers: [NotificationsController],
  providers: [NotificationsService, NotificationsProcessor, RedisService, IsolatedQueueService],
  exports: [NotificationsService, RedisService, IsolatedQueueService],
})
export class NotificationsModule {}
