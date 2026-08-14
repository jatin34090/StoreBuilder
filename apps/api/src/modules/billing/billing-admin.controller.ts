import {
  Controller, Get, Patch, Post, Body, Param, Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { IsEnum, IsString, IsOptional, IsInt, Min } from 'class-validator';
import { Plan, SubscriptionStatus } from '@prisma/client';
import { BillingService } from './billing.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '@jewellery/types';
import { CurrentUser, type AuthUser } from '../../common/decorators/current-user.decorator';

class AdminChangePlanDto {
  @IsEnum(Plan)     plan!: Plan;
  @IsOptional() @IsString() reason?: string;
}

class AdminExtendTrialDto {
  @IsInt() @Min(1) extraDays!: number;
}

@ApiTags('Super Admin — Billing')
@ApiBearerAuth()
@Roles(Role.SUPER_ADMIN)
@Controller('superadmin/billing')
export class BillingAdminController {
  constructor(private readonly billing: BillingService) {}

  @Get('dashboard')
  @ApiOperation({ summary: 'Billing dashboard: MRR, plan distribution, subscription stats' })
  getDashboard() {
    return this.billing.adminGetDashboard();
  }

  @Get('plans')
  @ApiOperation({ summary: 'Get all plan configurations (editable)' })
  getPlanConfigs() {
    return this.billing.adminGetPlanLimits();
  }

  @Patch('plans/:plan')
  @ApiOperation({ summary: 'Update plan limits, price, features, or description' })
  updatePlanConfig(
    @Param('plan') plan: Plan,
    @Body() body: Record<string, unknown>,
    @CurrentUser() actor: AuthUser,
  ) {
    return this.billing.adminUpdatePlanLimit(plan, actor.id, body);
  }

  @Get('subscriptions')
  @ApiOperation({ summary: 'List all store subscriptions with optional filters' })
  listSubscriptions(
    @Query('status') status?: SubscriptionStatus,
    @Query('plan')   plan?: Plan,
  ) {
    return this.billing.adminListSubscriptions({ status, plan } as any);
  }

  @Post('stores/:storeId/plan')
  @ApiOperation({ summary: 'Manually assign a plan to a store (with audit)' })
  changePlan(
    @Param('storeId') storeId: string,
    @Body() dto: AdminChangePlanDto,
    @CurrentUser() actor: AuthUser,
  ) {
    return this.billing.adminChangePlan(storeId, dto.plan, actor.id, dto.reason);
  }

  @Post('stores/:storeId/trial')
  @ApiOperation({ summary: 'Extend trial period for a store' })
  extendTrial(
    @Param('storeId') storeId: string,
    @Body() dto: AdminExtendTrialDto,
    @CurrentUser() actor: AuthUser,
  ) {
    return this.billing.adminExtendTrial(storeId, dto.extraDays, actor.id);
  }
}
