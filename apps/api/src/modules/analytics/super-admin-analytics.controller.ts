import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SuperAdminAnalyticsService } from './super-admin-analytics.service';
import { AnalyticsQueryDto } from './dto/analytics-query.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '@jewellery/types';

@ApiTags('Super Admin Analytics')
@ApiBearerAuth()
@Roles(Role.SUPER_ADMIN)
@Controller('super-admin/analytics')
export class SuperAdminAnalyticsController {
  constructor(private readonly analytics: SuperAdminAnalyticsService) {}

  @Get('overview')
  @ApiOperation({
    summary: 'Platform-wide KPI overview (SUPER_ADMIN)',
    description:
      'Total stores, active stores, platform revenue, total orders, total customers, ' +
      'estimated MRR from active subscriptions, and new-store growth rate vs previous period.',
  })
  getOverview(@Query() query: AnalyticsQueryDto) {
    return this.analytics.getPlatformOverview(query);
  }

  @Get('top-stores')
  @ApiOperation({
    summary: 'Top N stores by revenue (SUPER_ADMIN)',
    description: 'Ranks all stores by revenue for the given period. Use limit to control N (max 50).',
  })
  getTopStores(@Query() query: AnalyticsQueryDto) {
    return this.analytics.getTopStores(query);
  }

  @Get('subscriptions')
  @ApiOperation({
    summary: 'Subscription metrics & churn (SUPER_ADMIN)',
    description:
      'MRR breakdown by plan, active subscription count, scheduled churn, ' +
      'churn rate, activations and cancellations in the selected period.',
  })
  getSubscriptionMetrics(@Query() query: AnalyticsQueryDto) {
    return this.analytics.getSubscriptionMetrics(query);
  }

  @Get('api-usage')
  @ApiOperation({
    summary: 'API usage per store with error rate and latency (SUPER_ADMIN)',
    description:
      'Total calls, error calls, error rate %, avg response time, and p95 latency ' +
      'per store for the selected period. Sourced from TenantApiLog.',
  })
  getApiUsage(@Query() query: AnalyticsQueryDto) {
    return this.analytics.getApiUsageByStore(query);
  }

  @Get('new-stores-trend')
  @ApiOperation({
    summary: 'New store signups over time (SUPER_ADMIN)',
    description: 'Bucketed by granularity (day/week/month). Shows platform growth trajectory.',
  })
  getNewStoresTrend(@Query() query: AnalyticsQueryDto) {
    return this.analytics.getNewStoresTrend(query);
  }

  @Get('revenue-by-store')
  @ApiOperation({
    summary: 'Revenue breakdown table across all stores (SUPER_ADMIN)',
    description:
      'Per-store revenue, order count, avg order value, unique customer count, ' +
      'and revenue share % of platform total. Sorted by revenue descending.',
  })
  getRevenueByStore(@Query() query: AnalyticsQueryDto) {
    return this.analytics.getRevenueByStore(query);
  }
}
