import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiOkResponse } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { AnalyticsService } from './analytics.service';
import { AnalyticsQueryDto } from './dto/analytics-query.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CurrentStoreId } from '../../common/decorators/current-store.decorator';
import { RateCategory } from '../../common/decorators/rate-category.decorator';

@ApiTags('Analytics')
@ApiBearerAuth('access-token')
@Roles(Role.ADMIN)
@RequirePermission('analytics.read')
@RateCategory('analytics')
@Controller('admin/analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('overview')
  @ApiOperation({ summary: 'KPI overview: revenue, orders, customers, avg order value with growth rates' })
  @ApiOkResponse({ description: 'KPI overview scoped to the authenticated store' })
  getOverview(@CurrentStoreId() storeId: string, @Query() query: AnalyticsQueryDto) {
    return this.analyticsService.getOverview(storeId, query);
  }

  @Get('sales-trend')
  @ApiOperation({ summary: 'Revenue and order count over time (day/week/month buckets)' })
  @ApiOkResponse({ description: 'Time-series sales data for this store' })
  getSalesTrend(@CurrentStoreId() storeId: string, @Query() query: AnalyticsQueryDto) {
    return this.analyticsService.getSalesTrend(storeId, query);
  }

  @Get('top-products')
  @ApiOperation({ summary: 'Top products by revenue within the date range' })
  @ApiOkResponse({ description: 'Top-N products ranked by revenue for this store' })
  getTopProducts(@CurrentStoreId() storeId: string, @Query() query: AnalyticsQueryDto) {
    return this.analyticsService.getTopProducts(storeId, query);
  }

  @Get('order-status')
  @ApiOperation({ summary: 'Order status distribution with counts and percentages' })
  @ApiOkResponse({ description: 'Order status breakdown for this store' })
  getOrderStatusDistribution(@CurrentStoreId() storeId: string, @Query() query: AnalyticsQueryDto) {
    return this.analyticsService.getOrderStatusDistribution(storeId, query);
  }

  @Get('payments')
  @ApiOperation({ summary: 'Payment analytics: success rate, method split, refunds' })
  @ApiOkResponse({ description: 'Payment analytics for orders belonging to this store' })
  getPaymentAnalytics(@CurrentStoreId() storeId: string, @Query() query: AnalyticsQueryDto) {
    return this.analyticsService.getPaymentAnalytics(storeId, query);
  }

  @Get('delivery')
  @ApiOperation({ summary: 'Delivery performance: success rate and status distribution' })
  @ApiOkResponse({ description: 'Delivery metrics for orders belonging to this store' })
  getDeliveryAnalytics(@CurrentStoreId() storeId: string, @Query() query: AnalyticsQueryDto) {
    return this.analyticsService.getDeliveryAnalytics(storeId, query);
  }

  @Get('customer-growth')
  @ApiOperation({ summary: 'Unique customers per time bucket (users who ordered from this store)' })
  @ApiOkResponse({ description: 'Customer growth time-series scoped to this store' })
  getCustomerGrowth(@CurrentStoreId() storeId: string, @Query() query: AnalyticsQueryDto) {
    return this.analyticsService.getCustomerGrowth(storeId, query);
  }

  @Get('low-stock')
  @ApiOperation({ summary: 'Out-of-stock and low-stock variants for this store' })
  @ApiOkResponse({ description: 'Inventory alerts for active products in this store' })
  getLowStockSummary(@CurrentStoreId() storeId: string) {
    return this.analyticsService.getLowStockSummary(storeId);
  }
}
