'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Banknote, CheckCircle2, Clock, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { adminApi } from '@/lib/admin-api';
import { formatPrice } from '@/lib/utils';

type RemittanceStatus = 'PENDING' | 'SUBMITTED' | 'RECEIVED';

const STATUS_FILTERS: Array<{ label: string; value?: RemittanceStatus }> = [
  { label: 'All' },
  { label: 'Submitted', value: 'SUBMITTED' },
  { label: 'Received', value: 'RECEIVED' },
];

interface RemittanceItem {
  id: string;
  orderId: string;
  amount: number | string;
  collectedAt: string;
  order?: { orderNumber?: string };
}

interface Remittance {
  id: string;
  status: RemittanceStatus;
  totalAmount: number | string;
  submittedAt?: string;
  receivedAt?: string;
  notes?: string;
  agent?: { user?: { name?: string; phone?: string } };
  items?: RemittanceItem[];
}

export default function AdminRemittancesPage() {
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<RemittanceStatus | undefined>('SUBMITTED');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data: res, isLoading } = useQuery({
    queryKey: ['admin', 'remittances', statusFilter],
    queryFn: () => adminApi.remittances.list(statusFilter),
  });

  const remittances: Remittance[] = res?.data?.data?.remittances ?? [];

  const confirmMutation = useMutation({
    mutationFn: (id: string) => adminApi.remittances.confirm(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'remittances'] });
      toast.success('Remittance confirmed — payment marked as received');
    },
    onError: () => toast.error('Failed to confirm remittance'),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">COD Remittances</h1>
        <p className="text-sm text-muted-foreground">
          Agent cash handovers to admin
        </p>
      </div>

      {/* Filter chips */}
      <div className="flex gap-2">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.label}
            onClick={() => setStatusFilter(f.value)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              statusFilter === f.value
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : remittances.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <Banknote className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>No remittances found.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {remittances.map((r) => (
            <div key={r.id} className="border rounded-xl bg-card overflow-hidden">
              <div
                className="p-4 cursor-pointer hover:bg-muted/30 transition-colors"
                onClick={() => setExpandedId(expandedId === r.id ? null : r.id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {r.status === 'RECEIVED' ? (
                      <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
                    ) : (
                      <Clock className="w-5 h-5 text-orange-400 shrink-0" />
                    )}
                    <div>
                      <p className="font-semibold text-sm">{r.agent?.user?.name ?? 'Agent'}</p>
                      <p className="text-xs text-muted-foreground">{r.agent?.user?.phone ?? ''}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-base">{formatPrice(Number(r.totalAmount))}</p>
                    <Badge variant={r.status === 'RECEIVED' ? 'success' : 'secondary'} className="text-[10px]">
                      {r.status}
                    </Badge>
                  </div>
                </div>
                {r.submittedAt && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Submitted {new Date(r.submittedAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                  </p>
                )}
                {r.notes && <p className="text-xs text-muted-foreground italic mt-1">"{r.notes}"</p>}
              </div>

              {/* Expanded order list */}
              {expandedId === r.id && (
                <div className="border-t px-4 pb-4 pt-3 bg-muted/20">
                  <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Order Breakdown</p>
                  <div className="space-y-1.5 mb-4">
                    {(r.items ?? []).map((item) => (
                      <div key={item.id} className="flex justify-between text-sm">
                        <span className="text-muted-foreground">#{item.order?.orderNumber ?? item.orderId.slice(0, 8)}</span>
                        <span className="font-medium">{formatPrice(Number(item.amount))}</span>
                      </div>
                    ))}
                  </div>

                  {r.status === 'SUBMITTED' && (
                    <Button
                      className="w-full"
                      disabled={confirmMutation.isPending}
                      onClick={() => confirmMutation.mutate(r.id)}
                    >
                      {confirmMutation.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <><CheckCircle2 className="w-4 h-4 mr-2" /> Confirm Receipt</>
                      )}
                    </Button>
                  )}
                  {r.status === 'RECEIVED' && r.receivedAt && (
                    <p className="text-xs text-green-600 text-center">
                      Confirmed on {new Date(r.receivedAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                    </p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
