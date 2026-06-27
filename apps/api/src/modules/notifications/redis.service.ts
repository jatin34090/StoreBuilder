import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * RedisService — wraps ioredis in production, falls back to an in-memory
 * store when REDIS_URL is absent or clearly a placeholder (dev mode).
 */
@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private useMemory = false;
  private memStore = new Map<string, { value: string; expiresAt: number | null }>();
  private client: any = null;

  constructor(private configService: ConfigService) {
    const redisUrl = this.configService.get<string>('REDIS_URL', '');
    // Treat missing or placeholder URLs as "use memory"
    this.useMemory =
      !redisUrl ||
      redisUrl.includes('[password]') ||
      redisUrl.includes('placeholder') ||
      redisUrl === 'memory';
  }

  async onModuleInit() {
    if (this.useMemory) {
      this.logger.warn(
        '⚠️  REDIS_URL not configured — using in-memory store (dev only)',
      );
      return;
    }
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const Redis = require('ioredis');
      const redisUrl = this.configService.getOrThrow<string>('REDIS_URL');
      this.client = new Redis(redisUrl, {
        maxRetriesPerRequest: 3,
        lazyConnect: true,
      });
      this.client.on('error', (err: Error) =>
        this.logger.error('Redis error', err),
      );
      await this.client.connect();
      this.logger.log('✅ Redis connected');
    } catch (err) {
      this.logger.warn(
        'Redis connection failed — falling back to in-memory store',
      );
      this.useMemory = true;
    }
  }

  async onModuleDestroy() {
    if (this.client) await this.client.quit().catch(() => {});
  }

  // ─── In-memory helpers ────────────────────────────────────────────────────

  private memGet(key: string): string | null {
    const entry = this.memStore.get(key);
    if (!entry) return null;
    if (entry.expiresAt !== null && Date.now() > entry.expiresAt) {
      this.memStore.delete(key);
      return null;
    }
    return entry.value;
  }

  private memSet(key: string, value: string, ttlSeconds?: number) {
    this.memStore.set(key, {
      value,
      expiresAt: ttlSeconds ? Date.now() + ttlSeconds * 1000 : null,
    });
  }

  // ─── Public interface (mirrors ioredis) ───────────────────────────────────

  /**
   * Health probe. Returns 'memory' when running on the in-memory fallback
   * (dev), 'ok' when a real Redis responds to PING, or throws on failure.
   */
  async ping(): Promise<'ok' | 'memory'> {
    if (this.useMemory) return 'memory';
    const res = await this.client.ping();
    if (res !== 'PONG') throw new Error('Unexpected PING response');
    return 'ok';
  }

  async get(key: string): Promise<string | null> {
    if (this.useMemory) return this.memGet(key);
    return this.client.get(key);
  }

  async setEx(key: string, ttl: number, value: string): Promise<void> {
    if (this.useMemory) {
      this.memSet(key, value, ttl);
      return;
    }
    await this.client.setex(key, ttl, value);
  }

  async incr(key: string): Promise<number> {
    if (this.useMemory) {
      const current = parseInt(this.memGet(key) ?? '0', 10);
      const next = current + 1;
      const entry = this.memStore.get(key);
      this.memStore.set(key, {
        value: String(next),
        expiresAt: entry?.expiresAt ?? null,
      });
      return next;
    }
    return this.client.incr(key);
  }

  async expire(key: string, ttl: number): Promise<void> {
    if (this.useMemory) {
      const entry = this.memStore.get(key);
      if (entry)
        this.memStore.set(key, {
          ...entry,
          expiresAt: Date.now() + ttl * 1000,
        });
      return;
    }
    await this.client.expire(key, ttl);
  }

  async del(...keys: string[]): Promise<void> {
    if (this.useMemory) {
      keys.forEach((k) => this.memStore.delete(k));
      return;
    }
    await this.client.del(...keys);
  }

  async ttl(key: string): Promise<number> {
    if (this.useMemory) {
      const entry = this.memStore.get(key);
      if (!entry || entry.expiresAt === null) return -1;
      return Math.max(0, Math.floor((entry.expiresAt - Date.now()) / 1000));
    }
    return this.client.ttl(key);
  }

  getClient(): any {
    return this.useMemory ? null : this.client;
  }
}
