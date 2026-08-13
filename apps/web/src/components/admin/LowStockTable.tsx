'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { ExternalLink } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { TableSkeleton } from './LoadingSkeleton';
import { adminAnalyticsApi } from '../../lib/admin-api';

export function LowStockTable() {
  const { data: lowStock, isLoading } = useQuery({
    queryKey: ['admin', 'analytics', 'low-stock'],
    queryFn: () => adminAnalyticsApi.lowStock({ threshold: 10 }),
  });

  return (
    <Card className="border-0 shadow-sm bg-white">
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <CardTitle className="text-base font-semibold text-slate-800">Low Stock Alerts</CardTitle>
        <Button variant="ghost" size="sm" asChild className="text-primary h-8">
          <Link href="/admin/inventory">
            Manage <ExternalLink className="w-3.5 h-3.5 ml-1" />
          </Link>
        </Button>
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <TableSkeleton rows={5} cols={3} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  {['Product', 'SKU', 'Stock', 'Action'].map((h) => (
                    <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      {h}
                    </th>
                  ))}
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
                      <td className="px-4 py-3 text-xs text-slate-500 font-mono">{item.sku}</td>
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
                          className="h-7 text-xs border-primary text-primary hover:bg-primary hover:text-white"
                        >
                          <Link href={`/admin/inventory?variant=${item.variantId}`}>Restock</Link>
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
  );
}

