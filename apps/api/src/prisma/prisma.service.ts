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
    // Retry connect up to 5 times — Neon free tier can be slow to wake from cold start
    for (let attempt = 1; attempt <= 5; attempt++) {
      try {
        await this.$connect();
        this.logger.log('Prisma connected to PostgreSQL');
        break;
      } catch (err) {
        if (attempt === 5) {
          this.logger.warn('Prisma could not connect on startup — will retry on first query');
        } else {
          this.logger.warn(`DB connect attempt ${attempt} failed — retrying in 3s…`);
          await new Promise((r) => setTimeout(r, 3000));
        }
      }
    }
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
