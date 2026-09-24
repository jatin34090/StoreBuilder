import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { BillingService } from './billing.service';

@Injectable()
export class BillingCronService {
  private readonly logger = new Logger(BillingCronService.name);

  constructor(private readonly billing: BillingService) {}

  // Run daily at 02:00 UTC — expire trials that ended
  @Cron('0 2 * * *', { name: 'expire-trials' })
  async handleTrialExpiry(): Promise<void> {
    this.logger.log('Cron: checking for expired trials');
    try {
      await this.billing.expireTrials();
    } catch (err) {
      this.logger.error('Cron trial expiry failed', err);
    }
  }

  // Run daily at 03:00 UTC — mark past-due subscriptions
  @Cron('0 3 * * *', { name: 'subscription-health' })
  async handleSubscriptionHealth(): Promise<void> {
    this.logger.log('Cron: checking subscription health');
    try {
      await this.billing.checkSubscriptionHealth();
    } catch (err) {
      this.logger.error('Cron subscription health failed', err);
    }
  }

  // Run at 00:01 on the 1st of each month — reset monthly order counters
  @Cron('1 0 1 * *', { name: 'reset-monthly-orders' })
  async handleMonthlyOrderReset(): Promise<void> {
    this.logger.log('Cron: resetting monthly order counters');
    try {
      await this.billing.resetMonthlyOrderCounters();
    } catch (err) {
      this.logger.error('Cron monthly order reset failed', err);
    }
  }
}
