import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { QUEUE_NOTIFICATIONS, QUEUE_ANALYTICS } from './queue.constants';

@Module({
  imports: [
    BullModule.registerQueue({ name: QUEUE_NOTIFICATIONS }),
    BullModule.registerQueue({ name: QUEUE_ANALYTICS }),
  ],
  exports: [BullModule],
})
export class QueuesModule {}
