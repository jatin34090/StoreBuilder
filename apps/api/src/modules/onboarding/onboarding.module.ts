import { Module } from '@nestjs/common';
import { OnboardingController } from './onboarding.controller';
import { StoreProvisioningService } from '../stores/store-provisioning.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { TenantModule } from '../tenant/tenant.module';

@Module({
  imports: [PrismaModule, TenantModule],
  controllers: [OnboardingController],
  providers: [StoreProvisioningService],
})
export class OnboardingModule {}
