import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiOkResponse,
} from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { AnalyticsService } from './analytics.service';
import { AnalyticsQueryDto } from './dto/analytics-query.dto';
import { Roles } from '../../common/decorators/roles.decorator';

@ApiTags('Analytics')
@ApiBearerAuth()
@Roles(Role.ADMIN)
@Controller('admin/analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('overview')
  @ApiOperation({
    summary: 'Admin: dashboard KPI overview',
    description:
      'Returns total revenue, order count, new customers, active products, ' +
      'average order value, and period-over-period growth rates. ' +
      'Previous period window mirrors the requested date range.',
  })
  @ApiOkResponse({ description: 'KPI overview with growth metrics' })
  getOverview(@Query() query: AnalyticsQueryDto) {
    return this.analyticsService.getOverview(query);
  }

  @Get('sales-trend')
  @ApiOperation({
    summary: 'Admin: revenue and order count over time',
    description:
      'Groups revenue-generating orders by day/week/month using DATE_TRUNC. ' +
      'Only CONFIRMED, PROCESSING, SHIPPED, OUT_FOR_DELIVERY, and DELIVERED statuses count as revenue.',
  })
  @ApiOkResponse({ description: 'Time-series sales data' })
  getSalesTrend(@Query() query: AnalyticsQueryDto) {
    return this.analyticsService.getSalesTrend(query);
  }

  @Get('top-products')
  @ApiOperation({
    summary: 'Admin: top products by revenue',
    description:
      'Ranks products by total revenue within the date range. ' +
      'Also returns units sold and order count per product. ' +
      'Limit controls the number of products returned (max 50).',
  })
  @ApiOkResponse({ description: 'Top-N products ranked by revenue' })
  getTopProducts(@Query() query: AnalyticsQueryDto) {
    return this.analyticsService.getTopProducts(query);
  }

  @Get('order-status')
  @ApiOperation({
    summary: 'Admin: order status distribution',
    description:
      'Returns count and percentage for each order status within the date range. ' +
      'Useful for identifying bottlenecks in the fulfillment pipeline.',
  })
  @ApiOkResponse({ description: 'Order status distribution with percentages' })
  getOrderStatusDistribution(@Query() query: AnalyticsQueryDto) {
    return this.analyticsService.getOrderStatusDistribution(query);
  }

  @Get('payments')
  @ApiOperation({
    summary: 'Admin: payment analytics',
    description:
      'Breakdown of payment statuses (PENDING, PAID, FAILED, REFUNDED), ' +
      'payment methods (RAZORPAY, COD), overall success rate, and refund totals.',
  })
  @ApiOkResponse({ description: 'Payment status and method analytics' })
  getPaymentAnalytics(@Query() query: AnalyticsQueryDto) {
    return this.analyticsService.getPaymentAnalytics(query);
  }

  @Get('delivery')
  @ApiOperation({
    summary: 'Admin: delivery performance analytics',
    description:
      'Delivery success rate, average delivery time in hours (from assignment to delivery), ' +
      'and distribution by delivery type (SELF, THIRD_PARTY) and status.',
  })
  @ApiOkResponse({ description: 'Delivery performance metrics' })
  getDeliveryAnalytics(@Query() query: AnalyticsQueryDto) {
    return this.analyticsService.getDeliveryAnalytics(query);
  }

  @Get('customer-growth')
  @ApiOperation({
    summary: 'Admin: customer growth over time',
    description:
      'New customer signups bucketed by granularity (day/week/month). ' +
      'Also returns cumulative totals and verified vs unverified split.',
  })
  @ApiOkResponse({ description: 'Customer growth time-series and totals' })
  getCustomerGrowth(@Query() query: AnalyticsQueryDto) {
    return this.analyticsService.getCustomerGrowth(query);
  }

  @Get('low-stock')
  @ApiOperation({
    summary: 'Admin: low-stock and out-of-stock summary',
    description:
      'Lists active product variants with stock = 0 (out of stock) ' +
      'and stock between 1 and 5 (low stock). Sorted by stock ascending. ' +
      'No date range — always reflects current inventory state.',
  })
  @ApiOkResponse({ description: 'Low-stock and out-of-stock variant lists' })
  getLowStockSummary() {
    return this.analyticsService.getLowStockSummary();
  }
}
