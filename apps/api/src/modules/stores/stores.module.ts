import { Module, forwardRef } from '@nestjs/common';
import { StoresService } from './stores.service';
import { StoreProvisioningService } from './store-provisioning.service';
import { SuperAdminStoresController, AdminStoreController, PublicStoresController, InvitationController } from './stores.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { TenantModule } from '../tenant/tenant.module';
import { EventsModule } from '../events/events.module';
import { BillingModule } from '../billing/billing.module';

@Module({
  imports: [PrismaModule, TenantModule, EventsModule, forwardRef(() => BillingModule)],
  controllers: [SuperAdminStoresController, AdminStoreController, PublicStoresController, InvitationController],
  providers: [StoresService, StoreProvisioningService],
  exports: [StoresService, StoreProvisioningService],
})
export class StoresModule {}
