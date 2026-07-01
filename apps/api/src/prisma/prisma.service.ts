import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

// Neon free tier suspends after ~5 min idle; ping every 4 min to keep it warm.
const KEEP_ALIVE_MS = 4 * 60 * 1000;

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);
  private keepAliveTimer?: ReturnType<typeof setInterval>;

  constructor() {
    super({
      log: [
        { emit: 'event', level: 'query' },
        { emit: 'stdout', level: 'warn' },
        // 'error' intentionally omitted — Neon drops idle TCP connections and
        // Prisma logs each one as an error. Prisma reconnects automatically so
        // these are cosmetic noise, not real failures.
      ],
    });
  }

  async onModuleInit() {
    await this.$connect();
    this.logger.log('Prisma connected to PostgreSQL');
    this.keepAliveTimer = setInterval(async () => {
      try {
        await this.$queryRaw`SELECT 1`;
      } catch {
        // non-fatal — connection will re-establish on next real query
      }
    }, KEEP_ALIVE_MS);
  }

  async onModuleDestroy() {
    clearInterval(this.keepAliveTimer);
    await this.$disconnect();
    this.logger.log('Prisma disconnected');
  }
}
