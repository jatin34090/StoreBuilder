'use client';

import { use } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ShieldOff, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { superAdminApiClient } from '@/lib/super-admin-api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

const PLAN_COLORS: Record<string, string> = {
  FREE:         'bg-slate-100 text-slate-700',
  STARTER:      'bg-blue-100 text-blue-700',
  PROFESSIONAL: 'bg-violet-100 text-violet-700',
  ENTERPRISE:   'bg-amber-100 text-amber-700',
};

function UsageBar({ label, current, max, unit = '' }: { label: string; current: number; max: number; unit?: string }) {
  const unlimited = max <= 0;
  const pct       = unlimited ? 0 : Math.min(100, Math.round((current / max) * 100));
  const color     = pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-amber-500' : 'bg-violet-500';
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-slate-600">{label}</span>
        <span className="text-slate-500">
          {current.toLocaleString()}{unit} / {unlimited ? '∞' : `${max.toLocaleString()}${unit}`}
        </span>
      </div>
      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function StoreDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const qc     = useQueryClient();

  const { data: store, isLoading: loadingStore } = useQuery({
    queryKey: ['super-admin', 'store', id],
    queryFn:  () => superAdminApiClient.getStore(id),
  });

  const { data: usage, isLoading: loadingUsage } = useQuery({
    queryKey: ['super-admin', 'store-usage', id],
    queryFn:  () => superAdminApiClient.getUsage(id),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ['super-admin', 'store', id] });

  const suspendMutation = useMutation({
    mutationFn: () => superAdminApiClient.suspend(id),
    onSuccess: () => { toast.success('Store suspended'); invalidate(); },
    onError:   () => toast.error('Failed to suspend'),
  });

  const reinstateMutation = useMutation({
    mutationFn: () => superAdminApiClient.reinstate(id),
    onSuccess: () => { toast.success('Store reinstated'); invalidate(); },
    onError:   () => toast.error('Failed to reinstate'),
  });

  const planMutation = useMutation({
    mutationFn: (plan: string) => superAdminApiClient.updateStore(id, { plan }),
    onSuccess: () => { toast.success('Plan updated'); invalidate(); qc.invalidateQueries({ queryKey: ['super-admin', 'stores'] }); },
    onError:   () => toast.error('Failed to update plan'),
  });

  if (loadingStore) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i}><CardContent className="p-6 h-28 animate-pulse bg-slate-100 rounded-xl" /></Card>
        ))}
      </div>
    );
  }

  if (!store) return <p className="text-muted-foreground">Store not found.</p>;

  const q = usage?.quota;
  const l = usage?.limits;

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Back + header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/super-admin/stores"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div className="flex-1">
          <h2 className="text-xl font-bold text-slate-800">{store.name}</h2>
          <p className="text-sm text-muted-foreground">{store.slug}.yourdomain.in</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className={PLAN_COLORS[store.plan] ?? ''}>{store.plan}</Badge>
          <Badge variant={store.isActive ? 'default' : 'destructive'} className={store.isActive ? 'bg-green-100 text-green-700' : ''}>
            {store.isActive ? 'Active' : 'Suspended'}
          </Badge>
        </div>
      </div>

      {/* Actions */}
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-sm">Actions</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          {store.isActive ? (
            <Button variant="destructive" size="sm" onClick={() => suspendMutation.mutate()} disabled={suspendMutation.isPending}>
              <ShieldOff className="h-4 w-4 mr-2" />
              {suspendMutation.isPending ? 'Suspending…' : 'Suspend Store'}
            </Button>
          ) : (
            <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => reinstateMutation.mutate()} disabled={reinstateMutation.isPending}>
              <ShieldCheck className="h-4 w-4 mr-2" />
              {reinstateMutation.isPending ? 'Reinstating…' : 'Reinstate Store'}
            </Button>
          )}

          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-600">Change plan:</span>
            <Select value={store.plan} onValueChange={(v) => planMutation.mutate(v)} disabled={planMutation.isPending}>
              <SelectTrigger className="w-40 h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="FREE">Free</SelectItem>
                <SelectItem value="STARTER">Starter</SelectItem>
                <SelectItem value="PROFESSIONAL">Professional</SelectItem>
                <SelectItem value="ENTERPRISE">Enterprise</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Quota usage */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Quota Usage</CardTitle>
        </CardHeader>
        <CardContent>
          {loadingUsage ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-8 bg-slate-100 animate-pulse rounded" />
              ))}
            </div>
          ) : q && l ? (
            <div className="space-y-4">
              <UsageBar label="Products"       current={q.productCount} max={l.maxProducts} />
              <UsageBar label="Orders (month)" current={usage.computed.orderCountThisMonth} max={l.maxOrders ?? -1} />
              <UsageBar label="Storage"
                current={Math.round(q.storageBytes / (1024 ** 2))}
                max={l.maxStorageGB * 1024}
                unit=" MB"
              />
              <div className="pt-2 border-t text-xs text-muted-foreground">
                Total revenue: <span className="font-medium text-slate-700">₹{usage.computed.totalRevenue.toLocaleString()}</span>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No quota data available.</p>
          )}
        </CardContent>
      </Card>

      {/* Members */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Team Members ({store.users?.length ?? 0})</CardTitle>
        </CardHeader>
        <CardContent>
          {(store.users ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">No members.</p>
          ) : (
            <div className="divide-y">
              {store.users.map((su: { id: string; role: string; user: { id: string; name: string; email: string } }) => (
                <div key={su.id} className="flex items-center justify-between py-2.5">
                  <div>
                    <p className="text-sm font-medium">{su.user.name}</p>
                    <p className="text-xs text-muted-foreground">{su.user.email}</p>
                  </div>
                  <Badge variant="secondary" className="text-xs">{su.role}</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Info */}
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-sm">Store Info</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-3 text-sm">
          <div><p className="text-muted-foreground text-xs">Store ID</p><p className="font-mono text-xs mt-0.5">{store.id}</p></div>
          <div><p className="text-muted-foreground text-xs">Custom Domain</p><p className="mt-0.5">{store.customDomain ?? '—'}</p></div>
          <div><p className="text-muted-foreground text-xs">Products</p><p className="font-medium mt-0.5">{store._count?.products ?? 0}</p></div>
          <div><p className="text-muted-foreground text-xs">Orders</p><p className="font-medium mt-0.5">{store._count?.orders ?? 0}</p></div>
        </CardContent>
      </Card>
    </div>
  );
}
