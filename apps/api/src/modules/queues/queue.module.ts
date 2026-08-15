import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { QUEUE_NOTIFICATIONS, QUEUE_ANALYTICS } from './queue.constants';

// Default job options applied to every job added to these queues.
// Individual callers may override per-job via the options argument to queue.add().
const DEFAULT_JOB_OPTIONS = {
  attempts: 3,
  backoff: { type: 'exponential' as const, delay: 5_000 },
  removeOnComplete: 100, // keep last 100 completed jobs for observability
  removeOnFail: 200,     // keep last 200 failed jobs for dead-letter inspection
};

@Module({
  imports: [
    BullModule.registerQueue({ name: QUEUE_NOTIFICATIONS, defaultJobOptions: DEFAULT_JOB_OPTIONS }),
    BullModule.registerQueue({ name: QUEUE_ANALYTICS,     defaultJobOptions: DEFAULT_JOB_OPTIONS }),
  ],
  exports: [BullModule],
})
export class QueuesModule {}
