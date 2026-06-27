'use client';

import { useQuery } from '@tanstack/react-query';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import { format } from 'date-fns';
import {
  TrendingUp,
  TrendingDown,
  ShoppingBag,
  Users,
  AlertTriangle,
  IndianRupee,
  ExternalLink,
} from 'lucide-react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { Badge } from '../../../components/ui/badge';
import { Button } from '../../../components/ui/button';
import { Skeleton } from '../../../components/ui/skeleton';
import { StatusBadge } from '../../../components/admin/StatusBadge';
import { KpiCardSkeleton, ChartSkeleton, TableSkeleton } from '../../../components/admin/LoadingSkeleton';
import { adminAnalyticsApi, adminOrdersApi } from '../../../lib/admin-api';

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
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${iconBg}`}>
            {icon}
          </div>
        </div>
        <p className="text-2xl font-bold text-slate-900 mb-1">{value}</p>
        {change !== undefined && (
          <div className="flex items-center gap-1">
            {isPositive ? (
              <TrendingUp className="w-3.5 h-3.5 text-green-500" />
            ) : (
              <TrendingDown className="w-3.5 h-3.5 text-red-500" />
            )}
            <span
              className={`text-xs font-medium ${
                isPositive ? 'text-green-600' : 'text-red-600'
              }`}
            >
              {isPositive ? '+' : ''}{change.toFixed(1)}% from last month
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Donut chart colors ────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  PENDING: '#F59E0B',
  CONFIRMED: '#3B82F6',
  PROCESSING: '#8B5CF6',
  SHIPPED: '#6366F1',
  DELIVERED: '#10B981',
  CANCELLED: '#EF4444',
  RETURNED: '#F97316',
};

const PIE_COLORS = ['#10B981', '#F59E0B', '#3B82F6', '#8B5CF6', '#EF4444', '#6366F1', '#F97316'];

// ─── Formatters ───────────────────────────────────────────────────────────────

function formatCurrency(value: number) {
  if (value >= 100_000) return `₹${(value / 100_000).toFixed(1)}L`;
  if (value >= 1_000) return `₹${(value / 1_000).toFixed(1)}K`;
  return `₹${value.toFixed(0)}`;
}

function formatDate(dateStr: string) {
  try {
    return format(new Date(dateStr), 'dd MMM');
  } catch {
    return dateStr;
  }
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

  const { data: lowStock, isLoading: lowStockLoading } = useQuery({
    queryKey: ['admin', 'analytics', 'low-stock'],
    queryFn: () => adminAnalyticsApi.lowStock({ threshold: 10 }),
  });

  const { data: recentOrders, isLoading: ordersLoading } = useQuery({
    queryKey: ['admin', 'orders', 'recent'],
    queryFn: () => adminOrdersApi.list({ limit: 5 }),
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
              icon={<IndianRupee className="w-5 h-5 text-[#4A0E8F]" />}
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
              value={(lowStock?.length ?? 0).toString()}
              iconBg="bg-red-100"
              icon={<AlertTriangle className="w-5 h-5 text-red-500" />}
              badge={
                (lowStock?.length ?? 0) > 0 ? (
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
        {/* Revenue Trend */}
        <Card className="lg:col-span-2 border-0 shadow-sm bg-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold text-slate-800">
              Revenue Trend (Last 30 Days)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {salesLoading ? (
              <Skeleton className="h-64 w-full rounded-lg" />
            ) : (
              <ResponsiveContainer width="100%" height={256}>
                <AreaChart data={trend ?? []} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#4A0E8F" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#4A0E8F" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="ordersGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#D4A853" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#D4A853" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={formatDate}
                    tick={{ fontSize: 11, fill: '#94a3b8' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tickFormatter={formatCurrency}
                    tick={{ fontSize: 11, fill: '#94a3b8' }}
                    axisLine={false}
                    tickLine={false}
                    width={55}
                  />
                  <Tooltip
                    formatter={(value: number, name: string) => [
                      name === 'revenue' ? formatCurrency(value) : value,
                      name === 'revenue' ? 'Revenue' : 'Orders',
                    ]}
                    labelFormatter={(label) => formatDate(String(label))}
                    contentStyle={{
                      border: 'none',
                      borderRadius: '8px',
                      boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                      fontSize: '12px',
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    stroke="#4A0E8F"
                    strokeWidth={2}
                    fill="url(#revenueGrad)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Order Status Donut */}
        <Card className="border-0 shadow-sm bg-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold text-slate-800">
              Order Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            {statusLoading ? (
              <Skeleton className="h-64 w-full rounded-lg" />
            ) : (
              <ResponsiveContainer width="100%" height={256}>
                <PieChart>
                  <Pie
                    data={statuses ?? []}
                    cx="50%"
                    cy="45%"
                    innerRadius={55}
                    outerRadius={80}
                    dataKey="count"
                    nameKey="status"
                    paddingAngle={2}
                  >
                    {(statuses ?? []).map((entry, index) => (
                      <Cell
                        key={entry.status}
                        fill={STATUS_COLORS[entry.status] ?? PIE_COLORS[index % PIE_COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number, name: string) => [value, name]}
                    contentStyle={{
                      border: 'none',
                      borderRadius: '8px',
                      boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                      fontSize: '12px',
                    }}
                  />
                  <Legend
                    iconType="circle"
                    iconSize={8}
                    formatter={(value) => (
                      <span className="text-xs text-slate-600 capitalize">
                        {value.toLowerCase()}
                      </span>
                    )}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Tables row */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Recent Orders */}
        <Card className="border-0 shadow-sm bg-white">
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-base font-semibold text-slate-800">
              Recent Orders
            </CardTitle>
            <Button variant="ghost" size="sm" asChild className="text-[#4A0E8F] h-8">
              <Link href="/admin/orders">
                View all <ExternalLink className="w-3.5 h-3.5 ml-1" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            {ordersLoading ? (
              <TableSkeleton rows={5} cols={4} />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50">
                      <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                        Order
                      </th>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                        Customer
                      </th>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                        Amount
                      </th>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {(recentOrders?.items ?? []).length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-4 py-8 text-center text-slate-400 text-sm">
                          No recent orders
                        </td>
                      </tr>
                    ) : (
                      (recentOrders?.items ?? []).map((order) => (
                        <tr key={order.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-4 py-3">
                            <Link
                              href={`/admin/orders/${order.id}`}
                              className="font-medium text-[#4A0E8F] hover:underline text-xs"
                            >
                              #{order.orderNumber}
                            </Link>
                            <p className="text-xs text-slate-400 mt-0.5">
                              {formatDate(order.createdAt)}
                            </p>
                          </td>
                          <td className="px-4 py-3">
                            <p className="font-medium text-slate-700 text-xs">
                              {order.user?.name ?? '—'}
                            </p>
                            <p className="text-xs text-slate-400 truncate max-w-[120px]">
                              {order.user?.email ?? ''}
                            </p>
                          </td>
                          <td className="px-4 py-3 font-medium text-slate-800 text-xs">
                            ₹{Number(order.total ?? 0).toLocaleString('en-IN')}
                          </td>
                          <td className="px-4 py-3">
                            <StatusBadge status={order.status} size="sm" />
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Low Stock Alerts */}
        <Card className="border-0 shadow-sm bg-white">
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-base font-semibold text-slate-800">
              Low Stock Alerts
            </CardTitle>
            <Button variant="ghost" size="sm" asChild className="text-[#4A0E8F] h-8">
              <Link href="/admin/inventory">
                Manage <ExternalLink className="w-3.5 h-3.5 ml-1" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            {lowStockLoading ? (
              <TableSkeleton rows={5} cols={3} />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50">
                      <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                        Product
                      </th>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                        SKU
                      </th>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                        Stock
                      </th>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {(lowStock ?? []).length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-4 py-8 text-center text-slate-400 text-sm">
                          All products are sufficiently stocked
                        </td>
                      </tr>
                    ) : (
                      (lowStock ?? []).slice(0, 8).map((item) => (
                        <tr key={item.variantId} className="hover:bg-slate-50 transition-colors">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              {item.image ? (
                                <img
                                  src={item.image}
                                  alt={item.productName}
                                  className="w-7 h-7 rounded object-cover flex-shrink-0"
                                />
                              ) : (
                                <div className="w-7 h-7 rounded bg-slate-100 flex-shrink-0" />
                              )}
                              <p className="font-medium text-slate-700 text-xs truncate max-w-[130px]">
                                {item.productName}
                              </p>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-500 font-mono">
                            {item.sku}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`text-xs font-bold ${
                                item.stock === 0
                                  ? 'text-red-600'
                                  : item.stock < 5
                                  ? 'text-red-500'
                                  : 'text-orange-500'
                              }`}
                            >
                              {item.stock}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <Button
                              size="sm"
                              variant="outline"
                              asChild
                              className="h-7 text-xs border-[#4A0E8F] text-[#4A0E8F] hover:bg-[#4A0E8F] hover:text-white"
                            >
                              <Link href={`/admin/inventory?variant=${item.variantId}`}>
                                Restock
                              </Link>
                            </Button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
