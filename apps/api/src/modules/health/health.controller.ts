import { Controller, Get, HttpCode, HttpStatus, ServiceUnavailableException } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../notifications/redis.service';

interface Check {
  name: string;
  status: 'up' | 'down';
  detail?: string;
}

@ApiTags('Health')
@Controller('health')
export class HealthController {
  private readonly startedAt = Date.now();

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  /** Liveness — process is up. No external dependencies (used by orchestrators). */
  @Public()
  @Get('live')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Liveness probe' })
  live() {
    return {
      status: 'ok',
      uptime: Math.floor((Date.now() - this.startedAt) / 1000),
      timestamp: new Date().toISOString(),
    };
  }

  /** Readiness — dependencies (DB, Redis/queue backend) are reachable. */
  @Public()
  @Get('ready')
  @ApiOperation({ summary: 'Readiness probe (DB + Redis)' })
  async ready() {
    const checks = await this.runChecks();
    const healthy = checks.every((c) => c.status === 'up');
    if (!healthy) {
      throw new ServiceUnavailableException({ status: 'unavailable', checks });
    }
    return { status: 'ready', checks };
  }

  /** Full health report (also used by humans / dashboards). */
  @Public()
  @Get()
  @ApiOperation({ summary: 'Full health report' })
  async health() {
    const checks = await this.runChecks();
    const healthy = checks.every((c) => c.status === 'up');
    return {
      status: healthy ? 'ok' : 'degraded',
      uptime: Math.floor((Date.now() - this.startedAt) / 1000),
      timestamp: new Date().toISOString(),
      checks,
    };
  }

  private async runChecks(): Promise<Check[]> {
    const [db, redis] = await Promise.all([this.checkDb(), this.checkRedis()]);
    // Bull queues are backed by Redis, so the Redis check doubles as queue-backend health.
    const queue: Check = { name: 'queue', status: redis.status, detail: 'redis-backed (bull)' };
    return [db, redis, queue];
  }

  private async checkDb(): Promise<Check> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { name: 'database', status: 'up' };
    } catch (e) {
      return { name: 'database', status: 'down', detail: (e as Error).message?.slice(0, 120) };
    }
  }

  private async checkRedis(): Promise<Check> {
    try {
      const res = await this.redis.ping();
      return { name: 'redis', status: 'up', detail: res };
    } catch (e) {
      return { name: 'redis', status: 'down', detail: (e as Error).message?.slice(0, 120) };
    }
  }
}
