import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Req,
  Headers,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiExcludeEndpoint } from '@nestjs/swagger';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { BillingService } from './billing.service';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';
import { CurrentStoreId } from '../../common/decorators/current-store.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { Role } from '@jewellery/types';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';

@ApiTags('Billing')
@Controller()
export class BillingController {
  constructor(private readonly billing: BillingService) {}

  // ─── Public: list plans (used by plan comparison UI) ─────────────────────

  @Get('billing/plans')
  @Public()
  @ApiOperation({ summary: 'List all active subscription plans' })
  listPlans() {
    return this.billing.listPlans();
  }

  // ─── Store owner: full billing status + usage ────────────────────────────

  @Get('admin/billing/status')
  @Roles(Role.ADMIN)
  @RequirePermission('subscription.read')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get subscription status, usage, and all plan options' })
  getStatus(@CurrentStoreId() storeId: string) {
    return this.billing.getStatus(storeId);
  }

  // ─── Store owner: invoice/billing history ────────────────────────────────

  @Get('admin/billing/invoices')
  @Roles(Role.ADMIN)
  @RequirePermission('subscription.read')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get billing history (invoices) for this store' })
  getInvoices(@CurrentStoreId() storeId: string) {
    return this.billing.getInvoices(storeId);
  }

  // ─── Store owner: create / upgrade subscription ───────────────────────────

  @Post('admin/billing/subscribe')
  @Roles(Role.ADMIN)
  @RequirePermission('subscription.update')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create or upgrade a Razorpay subscription for this store' })
  createSubscription(
    @CurrentStoreId() storeId: string,
    @Body() dto: CreateSubscriptionDto,
  ) {
    return this.billing.createSubscription(storeId, dto);
  }

  // ─── Store owner: cancel at period end ───────────────────────────────────

  @Delete('admin/billing/cancel')
  @Roles(Role.ADMIN)
  @RequirePermission('subscription.update')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancel subscription at the end of the current billing period' })
  cancelSubscription(@CurrentStoreId() storeId: string) {
    return this.billing.cancelSubscription(storeId);
  }

  // ─── Store owner: reactivate scheduled cancellation ──────────────────────

  @Post('admin/billing/reactivate')
  @Roles(Role.ADMIN)
  @RequirePermission('subscription.update')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Undo a pending cancellation (if not yet lapsed)' })
  reactivateSubscription(@CurrentStoreId() storeId: string) {
    return this.billing.reactivateSubscription(storeId);
  }

  // ─── Public: Razorpay webhook (no JWT, raw body required) ─────────────────

  @Post('billing/webhook')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiExcludeEndpoint()
  handleWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('x-razorpay-signature') signature: string,
  ) {
    const rawBody = req.rawBody;
    if (!rawBody) return;
    return this.billing.handleWebhook(rawBody, signature);
  }
}
