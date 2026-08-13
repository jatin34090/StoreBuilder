'use client';

import { useQuery } from '@tanstack/react-query';
import dynamic from 'next/dynamic';
import { TrendingUp, TrendingDown, ShoppingBag, Users, AlertTriangle, IndianRupee } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { Badge } from '../../../components/ui/badge';
import { KpiCardSkeleton } from '../../../components/admin/LoadingSkeleton';
import { adminAnalyticsApi } from '../../../lib/admin-api';

// All heavy widgets are lazy-loaded — page shell compiles in ~2s,
// charts/tables compile asynchronously after first paint.
const RevenueTrendChart = dynamic(
  () => import('../../../components/admin/DashboardCharts').then((m) => ({ default: m.RevenueTrendChart })),
  { ssr: false, loading: () => <div className="h-64 w-full rounded-lg bg-slate-100 animate-pulse" /> },
);
const OrderStatusChart = dynamic(
  () => import('../../../components/admin/DashboardCharts').then((m) => ({ default: m.OrderStatusChart })),
  { ssr: false, loading: () => <div className="h-64 w-full rounded-lg bg-slate-100 animate-pulse" /> },
);
const RecentOrdersTable = dynamic(
  () => import('../../../components/admin/RecentOrdersTable').then((m) => ({ default: m.RecentOrdersTable })),
  { ssr: false, loading: () => <div className="h-64 w-full rounded-lg bg-slate-100 animate-pulse" /> },
);
const LowStockTable = dynamic(
  () => import('../../../components/admin/LowStockTable').then((m) => ({ default: m.LowStockTable })),
  { ssr: false, loading: () => <div className="h-64 w-full rounded-lg bg-slate-100 animate-pulse" /> },
);

// ─── KPI Card ────────────────────────────────────────────────────────────────

interface KpiCardProps {
  title: string;
  value: string;
  change?: number;
  icon: React.ReactNode;
  iconBg: string;
  badge?: React.ReactNode;
}

function KpiCard({ title, value, change, icon, iconBg, badge }: KpiCardProps) {
  const isPositive = (change ?? 0) >= 0;
  return (
    <Card className="border-0 shadow-sm bg-white">
      <CardContent className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-sm font-medium text-slate-500">{title}</p>
            {badge && <div className="mt-1">{badge}</div>}
          </div>
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${iconBg}`}>{icon}</div>
        </div>
        <p className="text-2xl font-bold text-slate-900 mb-1">{value}</p>
        {change !== undefined && (
          <div className="flex items-center gap-1">
            {isPositive ? (
              <TrendingUp className="w-3.5 h-3.5 text-green-500" />
            ) : (
              <TrendingDown className="w-3.5 h-3.5 text-red-500" />
            )}
            <span className={`text-xs font-medium ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
              {isPositive ? '+' : ''}{change.toFixed(1)}% from last month
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function formatCurrency(value: number) {
  if (value >= 100_000) return `₹${(value / 100_000).toFixed(1)}L`;
  if (value >= 1_000) return `₹${(value / 1_000).toFixed(1)}K`;
  return `₹${value.toFixed(0)}`;
}

// ─── Dashboard Page ───────────────────────────────────────────────────────────

export default function AdminDashboardPage() {
  const { data: overview, isLoading: overviewLoading } = useQuery({
    queryKey: ['admin', 'analytics', 'overview'],
    queryFn: () => adminAnalyticsApi.overview(),
  });

  const { data: trend, isLoading: salesLoading } = useQuery({
    queryKey: ['admin', 'analytics', 'sales-trend'],
    queryFn: () => adminAnalyticsApi.salesTrend({ granularity: 'day' }),
  });

  const { data: statuses, isLoading: statusLoading } = useQuery({
    queryKey: ['admin', 'analytics', 'order-status'],
    queryFn: () => adminAnalyticsApi.orderStatus(),
  });

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {overviewLoading ? (
          Array.from({ length: 4 }).map((_, i) => <KpiCardSkeleton key={i} />)
        ) : (
          <>
            <KpiCard
              title="Total Revenue"
              value={formatCurrency(overview?.totalRevenue ?? 0)}
              change={overview?.revenueChange}
              iconBg="bg-purple-100"
              icon={<IndianRupee className="w-5 h-5 text-primary" />}
            />
            <KpiCard
              title="Total Orders"
              value={(overview?.totalOrders ?? 0).toLocaleString()}
              change={overview?.ordersChange}
              iconBg="bg-blue-100"
              icon={<ShoppingBag className="w-5 h-5 text-blue-600" />}
            />
            <KpiCard
              title="Total Customers"
              value={(overview?.totalCustomers ?? 0).toLocaleString()}
              change={overview?.customersChange}
              iconBg="bg-green-100"
              icon={<Users className="w-5 h-5 text-green-600" />}
            />
            <KpiCard
              title="Low Stock Items"
              value={(overview?.activeProducts ?? 0).toString()}
              iconBg="bg-red-100"
              icon={<AlertTriangle className="w-5 h-5 text-red-500" />}
              badge={
                (overview?.activeProducts ?? 0) > 0 ? (
                  <Badge className="bg-red-100 text-red-700 border-0 text-xs px-1.5 py-0">
                    Action needed
                  </Badge>
                ) : undefined
              }
            />
          </>
        )}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 border-0 shadow-sm bg-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold text-slate-800">
              Revenue Trend (Last 30 Days)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <RevenueTrendChart data={trend} loading={salesLoading} />
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm bg-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold text-slate-800">Order Status</CardTitle>
          </CardHeader>
          <CardContent>
            <OrderStatusChart data={statuses} loading={statusLoading} />
          </CardContent>
        </Card>
      </div>

      {/* Tables row — lazy-loaded so initial compile only covers the shell above */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <RecentOrdersTable />
        <LowStockTable />
      </div>
    </div>
  );
}

