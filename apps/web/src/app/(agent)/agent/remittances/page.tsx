'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Banknote, CheckCircle2, Loader2, Send } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../../../../components/ui/button';
import { agentApi } from '../../../../lib/agent-api';
import { formatPrice } from '../../../../lib/utils';

interface RemittanceItem {
  id: string;
  orderId: string;
  amount: number | string;
  collectedAt: string;
  order?: { orderNumber?: string };
}

interface RemittanceSummary {
  pendingItems: RemittanceItem[];
  pendingTotal: number | string;
  submittedBatches: Array<{
    id: string;
    status: string;
    totalAmount: number | string;
    submittedAt?: string;
    receivedAt?: string;
    notes?: string;
    items?: RemittanceItem[];
  }>;
}

export default function AgentRemittancesPage() {
  const qc = useQueryClient();
  const [notes, setNotes] = useState('');
  const [showNotes, setShowNotes] = useState(false);

  const { data: res, isLoading } = useQuery({
    queryKey: ['agent', 'remittances'],
    queryFn: () => agentApi.getRemittances(),
  });

  const summary: RemittanceSummary | undefined = res?.data?.data;

  const submitMutation = useMutation({
    mutationFn: () => agentApi.submitRemittance(notes || undefined),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['agent', 'remittances'] });
      toast.success('Remittance submitted to admin');
      setNotes('');
      setShowNotes(false);
    },
    onError: () => toast.error('Failed to submit remittance'),
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-orange-500" />
      </div>
    );
  }

  const pendingItems = summary?.pendingItems ?? [];
  const pendingTotal = Number(summary?.pendingTotal ?? 0);
  const submittedBatches = summary?.submittedBatches ?? [];

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-bold text-slate-800">COD Remittances</h1>

      {/* Pending batch */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Banknote className="w-4 h-4 text-amber-500" />
            <p className="font-semibold text-slate-800 text-sm">Pending Collection</p>
          </div>
          <span className="text-sm font-bold text-amber-600">{formatPrice(pendingTotal)}</span>
        </div>

        {pendingItems.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-4">No pending cash to submit.</p>
        ) : (
          <>
            <div className="space-y-2 mb-4">
              {pendingItems.map((item) => (
                <div key={item.id} className="flex justify-between text-sm text-slate-600">
                  <span>Order #{item.order?.orderNumber ?? item.orderId.slice(0, 8)}</span>
                  <span className="font-medium text-slate-800">{formatPrice(Number(item.amount))}</span>
                </div>
              ))}
            </div>

            {showNotes && (
              <textarea
                placeholder="Add a note for the admin (optional)"
                value={notes}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNotes(e.target.value)}
                className="mb-3 text-sm w-full border rounded-md px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                rows={2}
              />
            )}

            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="text-slate-500"
                onClick={() => setShowNotes(!showNotes)}
              >
                {showNotes ? 'Hide Note' : 'Add Note'}
              </Button>
              <Button
                className="flex-1 bg-orange-500 hover:bg-orange-600 text-white h-9"
                disabled={submitMutation.isPending}
                onClick={() => submitMutation.mutate()}
              >
                {submitMutation.isPending
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : <><Send className="w-4 h-4 mr-2" /> Submit to Admin</>}
              </Button>
            </div>
          </>
        )}
      </div>

      {/* Past batches */}
      {submittedBatches.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide px-1">Past Submissions</p>
          {submittedBatches.map((batch) => (
            <div key={batch.id} className="bg-white rounded-xl border border-slate-200 p-4">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  {batch.status === 'RECEIVED' ? (
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                  ) : (
                    <Loader2 className="w-4 h-4 text-orange-400" />
                  )}
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                    batch.status === 'RECEIVED'
                      ? 'bg-green-100 text-green-700'
                      : 'bg-orange-100 text-orange-700'
                  }`}>
                    {batch.status === 'RECEIVED' ? 'Received' : 'Awaiting Confirmation'}
                  </span>
                </div>
                <span className="font-bold text-slate-800 text-sm">{formatPrice(Number(batch.totalAmount))}</span>
              </div>
              {batch.submittedAt && (
                <p className="text-xs text-slate-400">
                  Submitted {new Date(batch.submittedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                </p>
              )}
              {batch.receivedAt && (
                <p className="text-xs text-green-600">
                  Confirmed {new Date(batch.receivedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                </p>
              )}
              {batch.notes && <p className="text-xs text-slate-500 mt-1 italic">"{batch.notes}"</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
