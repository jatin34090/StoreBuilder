import { Processor, Process } from '@nestjs/bull';
import type { Job } from 'bull';
import { Logger } from '@nestjs/common';
import { QUEUE_NOTIFICATIONS, JOB_SEND_PUSH, JOB_BROADCAST } from '../queues/queue.constants';

// ─── Job payload shapes ───────────────────────────────────────────────────────

export interface SendPushJobData {
  token:  string;
  title:  string;
  body:   string;
  data?:  Record<string, unknown>;
}

export interface BroadcastJobData {
  tokens: string[];
  title:  string;
  body:   string;
  data?:  Record<string, unknown>;
}

// Expo API endpoint for push notifications (no SDK needed — plain HTTP is fine)
const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const EXPO_CHUNK_SIZE = 100; // Expo recommends batches of ≤ 100

@Processor(QUEUE_NOTIFICATIONS)
export class NotificationsProcessor {
  private readonly logger = new Logger(NotificationsProcessor.name);

  // ─── send-push: single user ───────────────────────────────────────────────

  @Process(JOB_SEND_PUSH)
  async handleSendPush(job: Job<SendPushJobData>): Promise<void> {
    const { token, title, body, data } = job.data;
    await this.sendExpoPush([{ to: token, title, body, data, sound: 'default' }]);
    this.logger.debug(`[PUSH] sent to token …${token.slice(-8)} title="${title}"`);
  }

  // ─── broadcast: multiple users ────────────────────────────────────────────

  @Process(JOB_BROADCAST)
  async handleBroadcast(job: Job<BroadcastJobData>): Promise<void> {
    const { tokens, title, body, data } = job.data;
    if (tokens.length === 0) return;

    // Split into chunks of 100 to respect Expo rate limits
    for (let i = 0; i < tokens.length; i += EXPO_CHUNK_SIZE) {
      const chunk = tokens.slice(i, i + EXPO_CHUNK_SIZE);
      const messages = chunk.map((to) => ({ to, title, body, data, sound: 'default' }));
      await this.sendExpoPush(messages);
    }

    this.logger.log(`[BROADCAST] sent to ${tokens.length} devices title="${title}"`);
  }

  // ─── Private: Expo HTTP v2 push ───────────────────────────────────────────

  private async sendExpoPush(
    messages: Array<{ to: string; title: string; body: string; sound: string; data?: Record<string, unknown> }>,
  ): Promise<void> {
    try {
      const res = await fetch(EXPO_PUSH_URL, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body:    JSON.stringify(messages),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => 'unknown');
        this.logger.warn(`Expo push HTTP ${res.status}: ${text}`);
        return;
      }

      const json = (await res.json()) as { data: Array<{ status: string; message?: string }> };
      const errors = json.data.filter((r) => r.status !== 'ok');
      if (errors.length > 0) {
        this.logger.warn(`Expo push: ${errors.length} errors — ${JSON.stringify(errors.slice(0, 3))}`);
      }
    } catch (err) {
      // Rethrow so Bull can retry the job according to its retry policy
      this.logger.error('Expo push fetch failed', err);
      throw err;
    }
  }
}
