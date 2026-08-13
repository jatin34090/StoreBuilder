'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { ExternalLink } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { StatusBadge } from './StatusBadge';
import { TableSkeleton } from './LoadingSkeleton';
import { adminOrdersApi } from '../../lib/admin-api';

function formatDate(dateStr: string) {
  try {
    return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short' }).format(new Date(dateStr));
  } catch {
    return dateStr;
  }
}

export function RecentOrdersTable() {
  const { data: recentOrders, isLoading } = useQuery({
    queryKey: ['admin', 'orders', 'recent'],
    queryFn: () => adminOrdersApi.list({ limit: 5 }),
  });

  return (
    <Card className="border-0 shadow-sm bg-white">
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <CardTitle className="text-base font-semibold text-slate-800">Recent Orders</CardTitle>
        <Button variant="ghost" size="sm" asChild className="text-primary h-8">
          <Link href="/admin/orders">
            View all <ExternalLink className="w-3.5 h-3.5 ml-1" />
          </Link>
        </Button>
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <TableSkeleton rows={5} cols={4} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  {['Order', 'Customer', 'Amount', 'Status'].map((h) => (
                    <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      {h}
                    </th>
                  ))}
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
                          className="font-medium text-primary hover:underline text-xs"
                        >
                          #{order.orderNumber}
                        </Link>
                        <p className="text-xs text-slate-400 mt-0.5">{formatDate(order.createdAt)}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-700 text-xs">{order.user?.name ?? '—'}</p>
                        <p className="text-xs text-slate-400 truncate max-w-[120px]">{order.user?.email ?? ''}</p>
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
  );
}

