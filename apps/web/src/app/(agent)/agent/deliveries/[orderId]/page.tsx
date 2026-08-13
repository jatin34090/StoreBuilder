'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, CheckCircle2, ClipboardList, Loader2, MapPin, Phone, XCircle, Banknote } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../../../../../components/ui/button';
import { Input } from '../../../../../components/ui/input';
import { Label } from '../../../../../components/ui/label';
import { Separator } from '../../../../../components/ui/separator';
import { agentApi, DeliveryStatus, NEXT_STATUS, STATUS_LABEL } from '../../../../../lib/agent-api';
import { formatPrice } from '../../../../../lib/utils';

const STATUS_STEP: DeliveryStatus[] = ['ASSIGNED', 'PICKED_UP', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED'];

export default function AgentDeliveryDetail() {
  const { orderId } = useParams<{ orderId: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const [otp, setOtp] = useState('');
  const [failureReason, setFailureReason] = useState('');
  const [showFail, setShowFail] = useState(false);

  const { data: res, isLoading, isError } = useQuery({
    queryKey: ['agent', 'delivery', orderId],
    queryFn: () => agentApi.getDelivery(orderId),
    enabled: !!orderId,
  });

  const delivery = res?.data?.data;
  const order = delivery?.order;
  const address = order?.address;

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['agent', 'delivery', orderId] });
    qc.invalidateQueries({ queryKey: ['agent', 'deliveries'] });
  };

  const statusMutation = useMutation({
    mutationFn: (status: DeliveryStatus) => agentApi.updateStatus(orderId, status),
    onSuccess: () => { invalidate(); toast.success('Status updated'); },
    onError: () => toast.error('Failed to update status'),
  });

  const failMutation = useMutation({
    mutationFn: () => agentApi.updateStatus(orderId, 'FAILED', failureReason || 'Delivery failed'),
    onSuccess: () => { invalidate(); toast.success('Marked as failed'); setShowFail(false); },
    onError: () => toast.error('Failed to update status'),
  });

  const otpMutation = useMutation({
    mutationFn: () => agentApi.verifyOtp(orderId, otp),
    onSuccess: () => { invalidate(); toast.success('Delivery confirmed! 🎉'); setOtp(''); },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg ?? 'Invalid OTP');
    },
  });

  const codMutation = useMutation({
    mutationFn: () => agentApi.codCollect(orderId),
    onSuccess: () => { invalidate(); toast.success('Cash collected — added to remittance batch'); },
    onError: () => toast.error('Failed to mark cash collected'),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-orange-500" />
      </div>
    );
  }

  if (isError || !delivery) {
    return (
      <div className="text-center py-20">
        <p className="text-slate-500">Delivery not found or not assigned to you.</p>
        <Button variant="link" onClick={() => router.back()}>Go back</Button>
      </div>
    );
  }

  const currentStatus = delivery.status as DeliveryStatus;
  const nextStatus = NEXT_STATUS[currentStatus];
  const currentStep = STATUS_STEP.indexOf(currentStatus);
  const isTerminal = ['DELIVERED', 'FAILED'].includes(currentStatus);
  const isCod = order?.payment?.method === 'COD';
  const codCollected = delivery.codCollected as boolean;

  return (
    <div className="space-y-4">
      {/* Back */}
      <button onClick={() => router.back()} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700">
        <ArrowLeft className="w-4 h-4" /> Back to deliveries
      </button>

      {/* Progress stepper */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-4">Delivery Progress</p>
        <div className="relative">
          {/* Track line */}
          <div className="absolute top-4 left-4 right-4 h-0.5 bg-slate-100" />
          <div
            className="absolute top-4 left-4 h-0.5 bg-orange-400 transition-all duration-500"
            style={{ width: `${(Math.max(0, currentStep) / (STATUS_STEP.length - 1)) * (100 - 0)}%` }}
          />
          <div className="relative flex justify-between">
            {STATUS_STEP.map((s, i) => {
              const done = currentStep > i || (currentStatus === 'DELIVERED' && i === STATUS_STEP.length - 1);
              const active = STATUS_STEP[i] === currentStatus;
              return (
                <div key={s} className="flex flex-col items-center gap-1.5">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-colors ${
                    done || active
                      ? 'bg-orange-500 border-orange-500 text-white'
                      : 'bg-white border-slate-200 text-slate-400'
                  }`}>
                    {done && !active ? <CheckCircle2 className="w-4 h-4" /> : i + 1}
                  </div>
                  <span className={`text-[10px] text-center max-w-[56px] leading-tight ${active ? 'text-orange-600 font-semibold' : 'text-slate-400'}`}>
                    {STATUS_LABEL[s]}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Order info */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
        <div className="flex items-start gap-3">
          <ClipboardList className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-slate-800">Order #{order?.orderNumber}</p>
            <p className="text-xs text-slate-500 mt-0.5">{order?.items?.length ?? 0} item(s) · {formatPrice(order?.total ?? 0)}</p>
          </div>
        </div>
        {order?.items?.slice(0, 3).map((item: { variantId: string; name?: string; quantity: number; price: number }) => (
          <div key={item.variantId} className="flex justify-between text-sm pl-7">
            <span className="text-slate-600 truncate max-w-[60%]">{item.name ?? 'Product'} ×{item.quantity}</span>
            <span className="text-slate-700 font-medium">{formatPrice(item.price * item.quantity)}</span>
          </div>
        ))}
        {(order?.items?.length ?? 0) > 3 && (
          <p className="text-xs text-slate-400 pl-7">+{order.items.length - 3} more items</p>
        )}
      </div>

      {/* Delivery address */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex items-start gap-3">
          <MapPin className="w-4 h-4 text-orange-500 mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold text-slate-800 text-sm">{address?.name}</p>
            <p className="text-slate-600 text-sm">{address?.line1}{address?.line2 ? `, ${address.line2}` : ''}</p>
            <p className="text-slate-500 text-sm">{address?.city}, {address?.state} — {address?.pincode}</p>
            {address?.phone && (
              <a href={`tel:${address.phone}`} className="inline-flex items-center gap-1.5 text-orange-500 text-sm mt-1.5 hover:underline">
                <Phone className="w-3.5 h-3.5" /> {address.phone}
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Action panel */}
      {!isTerminal && (
        <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Actions</p>

          {/* OTP verification (only when OUT_FOR_DELIVERY) */}
          {currentStatus === 'OUT_FOR_DELIVERY' ? (
            <div className="space-y-3">
              <p className="text-sm text-slate-600">
                Ask the customer for the 6-digit OTP sent to their phone to confirm delivery.
              </p>
              <div>
                <Label className="text-xs text-slate-500">Customer OTP</Label>
                <Input
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="• • • • • •"
                  inputMode="numeric"
                  maxLength={6}
                  className="mt-1 text-center tracking-[0.4em] text-lg h-12"
                />
              </div>
              <Button
                className="w-full bg-green-600 hover:bg-green-700 text-white h-11"
                disabled={otp.length !== 6 || otpMutation.isPending}
                onClick={() => otpMutation.mutate()}
              >
                {otpMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <><CheckCircle2 className="w-4 h-4 mr-2" /> Confirm Delivery</>}
              </Button>
            </div>
          ) : nextStatus ? (
            <Button
              className="w-full bg-orange-500 hover:bg-orange-600 text-white h-11"
              disabled={statusMutation.isPending}
              onClick={() => statusMutation.mutate(nextStatus)}
            >
              {statusMutation.isPending
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : `Mark as ${STATUS_LABEL[nextStatus]}`}
            </Button>
          ) : null}

          <Separator />

          {/* Mark as failed */}
          {!showFail ? (
            <Button variant="outline" className="w-full text-red-600 border-red-200 hover:bg-red-50" onClick={() => setShowFail(true)}>
              <XCircle className="w-4 h-4 mr-2" /> Mark as Failed
            </Button>
          ) : (
            <div className="space-y-2">
              <Label className="text-xs text-slate-500">Failure reason (optional)</Label>
              <Input
                placeholder="e.g. Customer not available"
                value={failureReason}
                onChange={(e) => setFailureReason(e.target.value)}
              />
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setShowFail(false)}>Cancel</Button>
                <Button className="flex-1 bg-red-600 hover:bg-red-700 text-white" disabled={failMutation.isPending} onClick={() => failMutation.mutate()}>
                  {failMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirm Failed'}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Terminal state banner */}
      {currentStatus === 'DELIVERED' && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" />
          <div>
            <p className="font-semibold text-green-800">Delivered successfully</p>
            <p className="text-green-700 text-sm">This delivery has been completed.</p>
          </div>
        </div>
      )}

      {/* COD cash collection */}
      {currentStatus === 'DELIVERED' && isCod && (
        <div className={`rounded-xl border p-4 ${codCollected ? 'bg-blue-50 border-blue-200' : 'bg-amber-50 border-amber-300'}`}>
          <div className="flex items-center gap-2 mb-2">
            <Banknote className={`w-5 h-5 shrink-0 ${codCollected ? 'text-blue-600' : 'text-amber-600'}`} />
            <p className={`font-semibold text-sm ${codCollected ? 'text-blue-800' : 'text-amber-800'}`}>
              {codCollected ? 'Cash Collected' : 'Cash on Delivery — Collect Payment'}
            </p>
          </div>
          {codCollected ? (
            <p className="text-blue-700 text-sm">
              ₹{Number(order?.total ?? 0).toFixed(2)} added to your remittance batch.
              Submit from the Remittances tab when ready.
            </p>
          ) : (
            <>
              <p className="text-amber-700 text-sm mb-3">
                Collect <span className="font-bold">₹{Number(order?.total ?? 0).toFixed(2)}</span> from the customer, then tap below.
              </p>
              <Button
                className="w-full bg-amber-500 hover:bg-amber-600 text-white h-10"
                disabled={codMutation.isPending}
                onClick={() => codMutation.mutate()}
              >
                {codMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Banknote className="w-4 h-4 mr-2" /> Mark Cash Collected</>}
              </Button>
            </>
          )}
        </div>
      )}
      {currentStatus === 'FAILED' && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
          <XCircle className="w-5 h-5 text-red-600 shrink-0" />
          <div>
            <p className="font-semibold text-red-800">Delivery failed</p>
            {delivery.failureReason && <p className="text-red-700 text-sm">{delivery.failureReason}</p>}
          </div>
        </div>
      )}
    </div>
  );
}
