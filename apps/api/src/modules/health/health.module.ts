import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { AuthModule } from '../auth/auth.module';

// PrismaService is global; AuthModule exports the shared RedisService.
@Module({
  imports: [AuthModule],
  controllers: [HealthController],
})
export class HealthModule {}
