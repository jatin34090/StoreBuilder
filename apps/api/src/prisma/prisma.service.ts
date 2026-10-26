import { Injectable, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

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

  async onModuleDestroy() {
    await this.$disconnect();
    this.logger.log('Prisma disconnected');
  }
}
