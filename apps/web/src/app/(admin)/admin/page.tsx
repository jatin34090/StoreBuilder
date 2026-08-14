'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import dynamic from 'next/dynamic';
import { TrendingUp, TrendingDown, ShoppingBag, Users, AlertTriangle, IndianRupee, Package } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { Badge } from '../../../components/ui/badge';
import { KpiCardSkeleton } from '../../../components/admin/LoadingSkeleton';
import { adminAnalyticsApi } from '../../../lib/admin-api';
import { useAdminAuthStore } from '../../../store/adminAuthStore';

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

// ─── Date Range ───────────────────────────────────────────────────────────────

type DateRangeKey = 'today' | 'yesterday' | '7d' | '30d' | 'month' | 'last_month';

interface DateRange { from: string; to: string; label: string }

function getDateRange(key: DateRangeKey): DateRange {
  const now  = new Date();
  const pad  = (n: number) => String(n).padStart(2, '0');
  const fmt  = (d: Date)   => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  switch (key) {
    case 'today': {
      const s = fmt(today);
      return { from: s, to: s, label: 'Today' };
    }
    case 'yesterday': {
      const d = new Date(today); d.setDate(d.getDate() - 1);
      const s = fmt(d);
      return { from: s, to: s, label: 'Yesterday' };
    }
    case '7d': {
      const d = new Date(today); d.setDate(d.getDate() - 6);
      return { from: fmt(d), to: fmt(today), label: 'Last 7 days' };
    }
    case '30d': {
      const d = new Date(today); d.setDate(d.getDate() - 29);
      return { from: fmt(d), to: fmt(today), label: 'Last 30 days' };
    }
    case 'month': {
      const d = new Date(today.getFullYear(), today.getMonth(), 1);
      return { from: fmt(d), to: fmt(today), label: 'This month' };
    }
    case 'last_month': {
      const first = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const last  = new Date(today.getFullYear(), today.getMonth(), 0);
      return { from: fmt(first), to: fmt(last), label: 'Last month' };
    }
  }
}

const DATE_OPTIONS: { key: DateRangeKey; label: string }[] = [
  { key: 'today',      label: 'Today' },
  { key: 'yesterday',  label: 'Yesterday' },
  { key: '7d',         label: 'Last 7 days' },
  { key: '30d',        label: 'Last 30 days' },
  { key: 'month',      label: 'This month' },
  { key: 'last_month', label: 'Last month' },
];

// ─── KPI Card ─────────────────────────────────────────────────────────────────

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
            {isPositive
              ? <TrendingUp className="w-3.5 h-3.5 text-green-500" />
              : <TrendingDown className="w-3.5 h-3.5 text-red-500" />}
            <span className={`text-xs font-medium ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
              {isPositive ? '+' : ''}{change.toFixed(1)}% vs prior period
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function formatCurrency(value: number) {
  if (value >= 100_000) return `₹${(value / 100_000).toFixed(1)}L`;
  if (value >= 1_000)   return `₹${(value / 1_000).toFixed(1)}K`;
  return `₹${value.toFixed(0)}`;
}

// ─── Dashboard Page ───────────────────────────────────────────────────────────

export default function AdminDashboardPage() {
  const [rangeKey, setRangeKey] = useState<DateRangeKey>('30d');
  const range = getDateRange(rangeKey);

  // Include store slug in query keys so each tenant gets its own cache entry
  const adminStore = useAdminAuthStore((s) => s.adminStore);
  const storeSlug  = adminStore?.slug ?? 'unknown';

  const { data: overview, isLoading: overviewLoading } = useQuery({
    queryKey: ['admin', storeSlug, 'analytics', 'overview', range.from, range.to],
    queryFn:  () => adminAnalyticsApi.overview(),
    enabled:  !!adminStore,
  });

  const { data: trend, isLoading: salesLoading } = useQuery({
    queryKey: ['admin', storeSlug, 'analytics', 'sales-trend', range.from, range.to],
    queryFn:  () => adminAnalyticsApi.salesTrend({ from: range.from, to: range.to, granularity: 'day' }),
    enabled:  !!adminStore,
  });

  const { data: statuses, isLoading: statusLoading } = useQuery({
    queryKey: ['admin', storeSlug, 'analytics', 'order-status', range.from, range.to],
    queryFn:  () => adminAnalyticsApi.orderStatus(),
    enabled:  !!adminStore,
  });

  return (
    <div className="space-y-6">
      {/* Header row with date filter */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">
            {adminStore?.businessName ?? adminStore?.name ?? 'Dashboard'}
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">Store overview · {range.label}</p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {DATE_OPTIONS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setRangeKey(key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                rangeKey === key
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

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
              title="Customers"
              value={(overview?.totalCustomers ?? 0).toLocaleString()}
              change={overview?.customersChange}
              iconBg="bg-green-100"
              icon={<Users className="w-5 h-5 text-green-600" />}
            />
            <KpiCard
              title="Active Products"
              value={(overview?.activeProducts ?? 0).toString()}
              iconBg="bg-violet-100"
              icon={<Package className="w-5 h-5 text-violet-600" />}
            />
          </>
        )}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 border-0 shadow-sm bg-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold text-slate-800">
              Revenue Trend · {range.label}
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

      {/* Tables row */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <RecentOrdersTable />
        <LowStockTable />
      </div>
    </div>
  );
}
