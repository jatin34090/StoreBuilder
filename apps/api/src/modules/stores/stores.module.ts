import { Module } from '@nestjs/common';
import { StoresService } from './stores.service';
import { StoreProvisioningService } from './store-provisioning.service';
import { SuperAdminStoresController, AdminStoreController, PublicStoresController } from './stores.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { TenantModule } from '../tenant/tenant.module';
import { EventsModule } from '../events/events.module';

@Module({
  imports: [PrismaModule, TenantModule, EventsModule],
  controllers: [SuperAdminStoresController, AdminStoreController, PublicStoresController],
  providers: [StoresService, StoreProvisioningService],
  exports: [StoresService, StoreProvisioningService],
})
export class StoresModule {}
