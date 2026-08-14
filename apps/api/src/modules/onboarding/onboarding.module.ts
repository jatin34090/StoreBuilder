import { Module, forwardRef } from '@nestjs/common';
import { OnboardingController } from './onboarding.controller';
import { StoreProvisioningService } from '../stores/store-provisioning.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { TenantModule } from '../tenant/tenant.module';
import { BillingModule } from '../billing/billing.module';

@Module({
  imports: [PrismaModule, TenantModule, forwardRef(() => BillingModule)],
  controllers: [OnboardingController],
  providers: [StoreProvisioningService],
})
export class OnboardingModule {}
