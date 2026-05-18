import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Req,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiParam,
  ApiOkResponse,
  ApiHeader,
} from '@nestjs/swagger';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { Role } from '@prisma/client';
import { PaymentsService } from './payments.service';
import { VerifyPaymentDto } from './dto/verify-payment.dto';
import { RefundDto } from './dto/refund.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Public } from '../../common/decorators/public.decorator';
import type { JwtPayload } from '@jewellery/types';

@ApiTags('Payments')
@ApiBearerAuth()
@Controller()
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  // ─── Customer: Verify Payment ──────────────────────────────────────────────

  @Post('payments/verify')
  @Roles(Role.CUSTOMER)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Verify Razorpay payment signature after checkout',
    description:
      'Client must call this immediately after Razorpay checkout success handler fires. ' +
      'Verifies HMAC-SHA256 signature, validates ownership, and confirms the order. ' +
      'Idempotent — safe to call again if the first response was lost.',
  })
  @ApiOkResponse({ description: 'Payment verified and order confirmed' })
  async verifyPayment(
    @CurrentUser() user: JwtPayload,
    @Body() dto: VerifyPaymentDto,
  ) {
    await this.paymentsService.verifyPayment(user.id, dto);
    return { message: 'Payment verified successfully. Order is now confirmed.' };
  }

  // ─── Razorpay Webhook ──────────────────────────────────────────────────────

  @Post('payments/webhook')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Razorpay webhook receiver (server-to-server)',
    description:
      'Handles payment.captured, payment.failed, refund.created, refund.processed events. ' +
      'Signature is verified using HMAC-SHA256 of raw body against RAZORPAY_WEBHOOK_SECRET. ' +
      'Always returns 200 — Razorpay retries on non-200.',
  })
  @ApiHeader({
    name: 'x-razorpay-signature',
    description: 'HMAC-SHA256 of raw body signed with webhook secret',
    required: true,
  })
  async webhook(@Req() req: RawBodyRequest<Request>) {
    const signature = req.headers['x-razorpay-signature'] as string;
    if (!signature) {
      return { status: 'missing signature' };
    }
    if (!req.rawBody) {
      return { status: 'missing body' };
    }
    await this.paymentsService.handleWebhook(req.rawBody, signature);
    return { status: 'ok' };
  }

  // ─── Customer / Admin: Get Payment Status ──────────────────────────────────

  @Get('payments/:orderId')
  @ApiOperation({
    summary: 'Get payment record for an order',
    description: 'Customers can only view their own orders. Admins can view any.',
  })
  @ApiParam({ name: 'orderId', description: 'Order UUID', format: 'uuid' })
  getPaymentStatus(
    @CurrentUser() user: JwtPayload,
    @Param('orderId', ParseUUIDPipe) orderId: string,
  ) {
    const isAdmin = user.role === Role.ADMIN;
    return this.paymentsService.getPaymentByOrder(orderId, user.id, isAdmin);
  }

  // ─── Admin: Initiate Refund ────────────────────────────────────────────────

  @Post('admin/payments/:orderId/refund')
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Admin: initiate a Razorpay refund for an order',
    description:
      'Calls Razorpay refund API. Omit `amount` for a full refund. ' +
      'Partial refunds are tracked with PARTIAL_REFUND status. ' +
      'COD orders are rejected — they must be handled offline.',
  })
  @ApiParam({ name: 'orderId', description: 'Order UUID', format: 'uuid' })
  async initiateRefund(
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @Body() dto: RefundDto,
  ) {
    await this.paymentsService.initiateRefund(orderId, dto);
    return { message: 'Refund initiated successfully' };
  }
}
