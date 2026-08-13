'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckCircle, ChevronRight, Package, Wifi, WifiOff } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/badge';
import { agentApi, DeliveryStatus, STATUS_LABEL } from '../../../lib/agent-api';
import { formatPrice } from '../../../lib/utils';

const STATUS_COLOR: Record<DeliveryStatus, string> = {
  PENDING:          'bg-slate-100 text-slate-600',
  ASSIGNED:         'bg-blue-100 text-blue-700',
  PICKED_UP:        'bg-yellow-100 text-yellow-700',
  IN_TRANSIT:       'bg-purple-100 text-purple-700',
  OUT_FOR_DELIVERY: 'bg-orange-100 text-orange-700',
  DELIVERED:        'bg-green-100 text-green-700',
  FAILED:           'bg-red-100 text-red-700',
};

export default function AgentDashboard() {
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<DeliveryStatus | 'ALL'>('ALL');

  const { data: profileRes } = useQuery({
    queryKey: ['agent', 'profile'],
    queryFn: () => agentApi.profile(),
  });
  const profile = profileRes?.data?.data;

  const { data: deliveriesRes, isLoading } = useQuery({
    queryKey: ['agent', 'deliveries', statusFilter],
    queryFn: () => agentApi.deliveries(statusFilter !== 'ALL' ? { status: statusFilter } : {}),
  });
  const deliveries: Array<{
    id: string;
    orderId: string;
    status: DeliveryStatus;
    order: {
      orderNumber: string;
      total: number;
      address: { name: string; line1: string; city: string; pincode: string };
    };
  }> = deliveriesRes?.data?.data?.deliveries ?? [];

  const onlineMutation = useMutation({
    mutationFn: (isOnline: boolean) => agentApi.toggleOnline(isOnline),
    onSuccess: (_, isOnline) => {
      qc.invalidateQueries({ queryKey: ['agent', 'profile'] });
      toast.success(isOnline ? 'You are now online' : 'You are now offline');
    },
    onError: () => toast.error('Failed to update status'),
  });

  const isOnline = profile?.isOnline ?? false;
  const active = deliveries.filter((d) => !['DELIVERED', 'FAILED'].includes(d.status));
  const done = deliveries.filter((d) => ['DELIVERED', 'FAILED'].includes(d.status));

  return (
    <div className="space-y-5">
      {/* Header card */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-500">Status</p>
          <div className="flex items-center gap-2 mt-0.5">
            <span className={`w-2.5 h-2.5 rounded-full ${isOnline ? 'bg-green-500' : 'bg-slate-300'}`} />
            <span className="font-semibold text-slate-800">{isOnline ? 'Online' : 'Offline'}</span>
          </div>
        </div>
        <Button
          size="sm"
          variant={isOnline ? 'outline' : 'default'}
          className={isOnline ? 'text-red-600 border-red-200 hover:bg-red-50' : 'bg-green-600 hover:bg-green-700 text-white'}
          disabled={onlineMutation.isPending}
          onClick={() => onlineMutation.mutate(!isOnline)}
        >
          {isOnline ? <><WifiOff className="w-3.5 h-3.5 mr-1.5" />Go Offline</> : <><Wifi className="w-3.5 h-3.5 mr-1.5" />Go Online</>}
        </Button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Active', value: active.length, color: 'text-orange-600' },
          { label: 'Delivered', value: deliveries.filter((d) => d.status === 'DELIVERED').length, color: 'text-green-600' },
          { label: 'Total', value: deliveries.length, color: 'text-slate-700' },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-xl border border-slate-200 p-3 text-center">
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-slate-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filter chips */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {(['ALL', 'ASSIGNED', 'PICKED_UP', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED'] as const).map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`shrink-0 text-xs px-3 py-1.5 rounded-full border transition-colors ${
              statusFilter === s
                ? 'bg-orange-500 text-white border-orange-500'
                : 'bg-white text-slate-600 border-slate-200 hover:border-orange-300'
            }`}
          >
            {s === 'ALL' ? 'All' : STATUS_LABEL[s]}
          </button>
        ))}
      </div>

      {/* Deliveries list */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-xl border border-slate-200 p-4 animate-pulse h-24" />
          ))}
        </div>
      ) : deliveries.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-10 text-center">
          <Package className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">No deliveries found</p>
          <p className="text-slate-400 text-sm mt-1">Go online to receive new assignments</p>
        </div>
      ) : (
        <div className="space-y-2">
          {/* Active deliveries first */}
          {active.length > 0 && (
            <>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide px-1">Active</p>
              {active.map((d) => (
                <DeliveryCard key={d.id} delivery={d} />
              ))}
            </>
          )}
          {done.length > 0 && (
            <>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide px-1 mt-4">Completed</p>
              {done.map((d) => (
                <DeliveryCard key={d.id} delivery={d} />
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function DeliveryCard({ delivery }: {
  delivery: {
    id: string;
    orderId: string;
    status: DeliveryStatus;
    order: { orderNumber: string; total: number; address: { name: string; line1: string; city: string; pincode: string } };
  };
}) {
  const addr = delivery.order.address;
  return (
    <Link href={`/agent/deliveries/${delivery.orderId}`}>
      <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-3 hover:border-orange-300 transition-colors active:scale-[0.99]">
        <div className={`w-2 h-12 rounded-full shrink-0 ${delivery.status === 'DELIVERED' ? 'bg-green-400' : delivery.status === 'FAILED' ? 'bg-red-400' : 'bg-orange-400'}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-semibold text-slate-800 text-sm">#{delivery.order.orderNumber}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLOR[delivery.status]}`}>
              {STATUS_LABEL[delivery.status]}
            </span>
          </div>
          <p className="text-sm text-slate-600 truncate">{addr.name}</p>
          <p className="text-xs text-slate-400 truncate">{addr.line1}, {addr.city} — {addr.pincode}</p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-sm font-semibold text-slate-700">{formatPrice(delivery.order.total)}</p>
          {delivery.status === 'DELIVERED' && <CheckCircle className="w-4 h-4 text-green-500 mt-1 ml-auto" />}
          {!['DELIVERED', 'FAILED'].includes(delivery.status) && <ChevronRight className="w-4 h-4 text-slate-400 mt-1 ml-auto" />}
        </div>
      </div>
    </Link>
  );
}
