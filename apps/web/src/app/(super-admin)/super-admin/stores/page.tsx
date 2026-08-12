'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, ExternalLink, ShieldOff, ShieldCheck } from 'lucide-react';
import { superAdminApiClient, type StoreRow } from '@/lib/super-admin-api';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import Link from 'next/link';
import { toast } from 'sonner';

const PLAN_COLORS: Record<string, string> = {
  FREE:         'bg-slate-100 text-slate-600',
  STARTER:      'bg-blue-100 text-blue-700',
  PROFESSIONAL: 'bg-violet-100 text-violet-700',
  ENTERPRISE:   'bg-amber-100 text-amber-700',
};

function StorePlanBadge({ plan }: { plan: string }) {
  return <Badge variant="secondary" className={PLAN_COLORS[plan] ?? ''}>{plan}</Badge>;
}

export default function SuperAdminStoresPage() {
  const qc = useQueryClient();
  const [search, setSearch]   = useState('');
  const [plan, setPlan]       = useState('ALL');
  const [status, setStatus]   = useState('ALL');
  const [page, setPage]       = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['super-admin', 'stores', { search, plan, status, page }],
    queryFn: () => superAdminApiClient.listStores({
      page,
      search: search || undefined,
      plan:   plan !== 'ALL' ? plan : undefined,
      isActive: status === 'ALL' ? undefined : status === 'ACTIVE',
    }),
  });

  const suspendMutation = useMutation({
    mutationFn: (id: string) => superAdminApiClient.suspend(id),
    onSuccess: () => { toast.success('Store suspended'); qc.invalidateQueries({ queryKey: ['super-admin', 'stores'] }); },
    onError: () => toast.error('Failed to suspend store'),
  });

  const reinstateMutation = useMutation({
    mutationFn: (id: string) => superAdminApiClient.reinstate(id),
    onSuccess: () => { toast.success('Store reinstated'); qc.invalidateQueries({ queryKey: ['super-admin', 'stores'] }); },
    onError: () => toast.error('Failed to reinstate store'),
  });

  const stores: StoreRow[] = data?.stores ?? [];
  const pagination         = data?.pagination;

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or slug…"
            className="pl-9"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>

        <Select value={plan} onValueChange={(v) => { setPlan(v); setPage(1); }}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Plan" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All plans</SelectItem>
            <SelectItem value="FREE">Free</SelectItem>
            <SelectItem value="STARTER">Starter</SelectItem>
            <SelectItem value="PROFESSIONAL">Professional</SelectItem>
            <SelectItem value="ENTERPRISE">Enterprise</SelectItem>
          </SelectContent>
        </Select>

        <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
          <SelectTrigger className="w-36"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All status</SelectItem>
            <SelectItem value="ACTIVE">Active</SelectItem>
            <SelectItem value="SUSPENDED">Suspended</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-slate-50 text-left">
                  <th className="px-4 py-3 font-medium text-slate-600">Store</th>
                  <th className="px-4 py-3 font-medium text-slate-600 hidden md:table-cell">Plan</th>
                  <th className="px-4 py-3 font-medium text-slate-600 hidden lg:table-cell">Products</th>
                  <th className="px-4 py-3 font-medium text-slate-600 hidden lg:table-cell">Orders</th>
                  <th className="px-4 py-3 font-medium text-slate-600">Status</th>
                  <th className="px-4 py-3 font-medium text-slate-600 hidden xl:table-cell">Created</th>
                  <th className="px-4 py-3 w-10" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {isLoading ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <tr key={i}>
                      {Array.from({ length: 6 }).map((__, j) => (
                        <td key={j} className="px-4 py-3">
                          <div className="h-4 bg-slate-100 rounded animate-pulse" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : stores.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                      No stores found.
                    </td>
                  </tr>
                ) : stores.map((store) => (
                  <tr key={store.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium text-slate-800">{store.name}</p>
                        <p className="text-xs text-muted-foreground">{store.slug}.yourdomain.in</p>
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <StorePlanBadge plan={store.plan} />
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell text-slate-700">
                      {store._count.products}
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell text-slate-700">
                      {store._count.orders}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={store.isActive ? 'default' : 'destructive'} className={store.isActive ? 'bg-green-100 text-green-700' : ''}>
                        {store.isActive ? 'Active' : 'Suspended'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 hidden xl:table-cell text-slate-500 text-xs">
                      {new Date(store.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                          <Link href={`/super-admin/stores/${store.id}`}>
                            <ExternalLink className="h-3.5 w-3.5" />
                          </Link>
                        </Button>
                        {store.isActive ? (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => suspendMutation.mutate(store.id)}
                            disabled={suspendMutation.isPending}
                          >
                            <ShieldOff className="h-3.5 w-3.5" />
                          </Button>
                        ) : (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-green-600 hover:text-green-700"
                            onClick={() => reinstateMutation.mutate(store.id)}
                            disabled={reinstateMutation.isPending}
                          >
                            <ShieldCheck className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {pagination && pagination.total > pagination.limit && (
            <div className="flex items-center justify-between px-4 py-3 border-t text-sm text-slate-600">
              <span>{pagination.total} stores total</span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(page - 1)}>
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page * pagination.limit >= pagination.total}
                  onClick={() => setPage(page + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
