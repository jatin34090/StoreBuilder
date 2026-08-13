import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  HttpCode,
  HttpStatus,
  ForbiddenException,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { CurrentUser, type AuthUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { SetMetadata } from '@nestjs/common';
import { SKIP_TENANT_RATE_LIMIT } from '../../common/guards/tenant-rate-limit.guard';
import { StoreProvisioningService } from '../stores/store-provisioning.service';
import { INDUSTRY_TEMPLATES } from '../stores/industry-templates';
import {
  CreateStoreOnboardingDto,
  MarkOnboardingStepDto,
} from './dto/create-store-onboarding.dto';

@ApiTags('Onboarding')
@ApiBearerAuth('access-token')
@SetMetadata(SKIP_TENANT_RATE_LIMIT, true)
@Controller('onboarding')
export class OnboardingController {
  constructor(private readonly provisioning: StoreProvisioningService) {}

  /** List available industry templates */
  @Public()
  @Get('templates')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List industry/store templates' })
  getTemplates() {
    return Object.values(INDUSTRY_TEMPLATES).map(({ id, label, description, categories, navItems }) => ({
      id, label, description, categories, navItems,
    }));
  }

  /**
   * Self-serve store creation — called after registration.
   * The authenticated user becomes the OWNER of the new store.
   */
  @Post('store')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create and provision a new store (self-serve onboarding)' })
  async createStore(
    @Body() dto: CreateStoreOnboardingDto,
    @CurrentUser() user: AuthUser,
  ) {
    if (!user?.id) throw new ForbiddenException('Authentication required');

    const store = await this.provisioning.provision({
      name:         dto.name,
      slug:         dto.slug,
      businessName: dto.businessName,
      industry:     dto.industry,
      description:  dto.description,
      contactEmail: dto.contactEmail,
      phone:        dto.phone,
      address:      dto.address,
      country:      dto.country,
      currency:     dto.currency,
      timezone:     dto.timezone,
      plan:         dto.plan,
      ownerUserId:  user.id,
    });

    return store;
  }

  /** Onboarding progress for the current user's store */
  @Get('progress')
  @ApiOperation({ summary: "Return store's onboarding progress" })
  async getProgress(@CurrentUser() user: AuthUser) {
    if (!user?.storeId) return { steps: [], percent: 0 };
    return this.provisioning.getOnboardingState(user.storeId);
  }

  /** Mark a single onboarding step complete (or incomplete) */
  @Patch('step')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark an onboarding step as done/undone' })
  async markStep(@Body() dto: MarkOnboardingStepDto, @CurrentUser() user: AuthUser) {
    if (!user?.storeId) throw new ForbiddenException('No store context — complete store creation first');
    await this.provisioning.markStep(user.storeId, dto.step, dto.done ?? true);
    return this.provisioning.getOnboardingState(user.storeId);
  }
}
