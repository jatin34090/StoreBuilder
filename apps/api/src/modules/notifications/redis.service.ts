import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis;

  constructor(private configService: ConfigService) {
    this.client = new Redis(this.configService.getOrThrow<string>('REDIS_URL'), {
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    });

    this.client.on('error', (err) => this.logger.error('Redis error', err));
  }

  async onModuleInit() {
    await this.client.connect();
    this.logger.log('Redis connected');
  }

  async onModuleDestroy() {
    await this.client.quit();
    this.logger.log('Redis disconnected');
  }

  get(key: string) {
    return this.client.get(key);
  }

  setEx(key: string, ttl: number, value: string) {
    return this.client.setex(key, ttl, value);
  }

  incr(key: string) {
    return this.client.incr(key);
  }

  expire(key: string, ttl: number) {
    return this.client.expire(key, ttl);
  }

  del(...keys: string[]) {
    return this.client.del(...keys);
  }

  ttl(key: string) {
    return this.client.ttl(key);
  }

  getClient(): Redis {
    return this.client;
  }
}
