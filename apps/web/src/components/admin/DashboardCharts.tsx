'use client';

import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import { Skeleton } from '../ui/skeleton';

const STATUS_COLORS: Record<string, string> = {
  PENDING: '#F59E0B', CONFIRMED: '#3B82F6', PROCESSING: '#8B5CF6',
  SHIPPED: '#6366F1', DELIVERED: '#10B981', CANCELLED: '#EF4444', RETURNED: '#F97316',
};
const PIE_COLORS = ['#10B981', '#F59E0B', '#3B82F6', '#8B5CF6', '#EF4444', '#6366F1', '#F97316'];

function formatCurrency(value: number) {
  if (value >= 100_000) return `₹${(value / 100_000).toFixed(1)}L`;
  if (value >= 1_000) return `₹${(value / 1_000).toFixed(1)}K`;
  return `₹${value.toFixed(0)}`;
}
function formatDate(dateStr: string) {
  try { return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short' }).format(new Date(dateStr)); } catch { return dateStr; }
}

interface TrendItem { date: string; revenue: number; orders: number }
interface StatusItem { status: string; count: number }

export function RevenueTrendChart({ data, loading }: { data?: TrendItem[]; loading: boolean }) {
  if (loading) return <Skeleton className="h-64 w-full rounded-lg" />;
  return (
    <ResponsiveContainer width="100%" height={256}>
      <AreaChart data={data ?? []} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
            <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
        <XAxis dataKey="date" tickFormatter={formatDate} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
        <YAxis tickFormatter={formatCurrency} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={55} />
        <Tooltip
          formatter={(value: number, name: string) => [name === 'revenue' ? formatCurrency(value) : value, name === 'revenue' ? 'Revenue' : 'Orders']}
          labelFormatter={(l) => formatDate(String(l))}
          contentStyle={{ border: 'none', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: '12px' }}
        />
        <Area type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#revenueGrad)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function OrderStatusChart({ data, loading }: { data?: StatusItem[]; loading: boolean }) {
  if (loading) return <Skeleton className="h-64 w-full rounded-lg" />;
  return (
    <ResponsiveContainer width="100%" height={256}>
      <PieChart>
        <Pie data={data ?? []} cx="50%" cy="45%" innerRadius={55} outerRadius={80} dataKey="count" nameKey="status" paddingAngle={2}>
          {(data ?? []).map((entry, index) => (
            <Cell key={entry.status} fill={STATUS_COLORS[entry.status] ?? PIE_COLORS[index % PIE_COLORS.length]} />
          ))}
        </Pie>
        <Tooltip
          formatter={(value: number, name: string) => [value, name]}
          contentStyle={{ border: 'none', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: '12px' }}
        />
        <Legend iconType="circle" iconSize={8} formatter={(value) => (
          <span className="text-xs text-slate-600 capitalize">{value.toLowerCase()}</span>
        )} />
      </PieChart>
    </ResponsiveContainer>
  );
}

