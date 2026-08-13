import { Module, Global } from '@nestjs/common';
import { TenantService } from './tenant.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Global() // TenantService available everywhere without importing TenantModule
@Module({
  imports: [PrismaModule, NotificationsModule],
  providers: [TenantService],
  exports: [TenantService],
})
export class TenantModule {}
