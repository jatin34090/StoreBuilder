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

@ApiTags('Billing')
@Controller()
export class BillingController {
  constructor(private readonly billing: BillingService) {}

  // ─── Store owner: create / upgrade subscription ───────────────────────────

  @Post('admin/billing/subscribe')
  @Roles(Role.ADMIN)
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
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancel subscription at the end of the current billing period' })
  cancelSubscription(@CurrentStoreId() storeId: string) {
    return this.billing.cancelSubscription(storeId);
  }

  // ─── Store owner: subscription status + quota ─────────────────────────────

  @Get('admin/billing/status')
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current subscription status, quota usage, and plan limits' })
  getStatus(@CurrentStoreId() storeId: string) {
    return this.billing.getStatus(storeId);
  }

  // ─── Public Razorpay webhook (no JWT, raw body required) ─────────────────

  @Post('billing/webhook')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiExcludeEndpoint()
  handleWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('x-razorpay-signature') signature: string,
  ) {
    const rawBody = req.rawBody;
    if (!rawBody) {
      return; // no-op — should not happen in production (rawBody must be enabled in main.ts)
    }
    return this.billing.handleWebhook(rawBody, signature);
  }
}
