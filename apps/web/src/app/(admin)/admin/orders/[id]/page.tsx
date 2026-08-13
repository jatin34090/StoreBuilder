'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import { fmtDate } from '../../../../../lib/formatters';
import { toast } from 'sonner';
import { ArrowLeft, RefreshCw, Package, ExternalLink } from 'lucide-react';
import { Button } from '../../../../../components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../../../components/ui/select';
import { Input } from '../../../../../components/ui/input';
import { Label } from '../../../../../components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../../../../../components/ui/dialog';
import { PageHeader } from '../../../../../components/admin/PageHeader';
import { StatusBadge } from '../../../../../components/admin/StatusBadge';
import { TableSkeleton } from '../../../../../components/admin/LoadingSkeleton';
import { adminApi, OrderStatus } from '../../../../../lib/admin-api';

const VALID_NEXT_STATUSES: Partial<Record<OrderStatus, OrderStatus[]>> = {
  PENDING:          ['CONFIRMED', 'CANCELLED'],
  CONFIRMED:        ['PROCESSING', 'CANCELLED'],
  PROCESSING:       ['SHIPPED', 'CANCELLED'],
  SHIPPED:          ['OUT_FOR_DELIVERY'],
  OUT_FOR_DELIVERY: ['DELIVERED', 'CANCELLED'],
  DELIVERED:        [],
  CANCELLED:        [],
  RETURN_REQUESTED: ['RETURNED'],
  RETURNED:         ['REFUNDED'],
  REFUNDED:         [],
};

export default function AdminOrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const id = params.id as string;

  const [newStatus, setNewStatus] = useState<OrderStatus | ''>('');
  const [agentId, setAgentId] = useState('');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [refundOpen, setRefundOpen] = useState(false);
  const [refundAmount, setRefundAmount] = useState('');
  const [refundReason, setRefundReason] = useState('');

  const { data: orderRes, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin', 'orders', id],
    queryFn: () => adminApi.orders.get(id),
    enabled: !!id,
  });

  const { data: agentsRes } = useQuery({
    queryKey: ['admin', 'agents'],
    queryFn: () => adminApi.delivery.listAgents(),
  });

  const order = orderRes;
  const agents = agentsRes?.items ?? [];

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['admin', 'orders', id] });
    queryClient.invalidateQueries({ queryKey: ['admin', 'orders'] });
  };

  const statusMutation = useMutation({
    mutationFn: () => adminApi.orders.updateStatus(id, newStatus as OrderStatus),
    onSuccess: () => {
      invalidate();
      toast.success('Order status updated');
      setNewStatus('');
    },
    onError: () => toast.error('Failed to update status'),
  });

  const deliveryMutation = useMutation({
    mutationFn: () =>
      adminApi.orders.updateDelivery(id, {
        ...(agentId ? { agentId } : {}),
        ...(trackingNumber ? { awbCode: trackingNumber } : {}),
      }),
    onSuccess: () => {
      invalidate();
      toast.success('Delivery info updated');
      setAgentId('');
      setTrackingNumber('');
    },
    onError: () => toast.error('Failed to update delivery info'),
  });

  const shiprocketMutation = useMutation({
    mutationFn: () => adminApi.orders.shipViaShiprocket(id),
    onSuccess: (result) => {
      invalidate();
      toast.success(`Shiprocket shipment created — AWB: ${result.awbCode} (${result.courierName})`);
    },
    onError: () => toast.error('Failed to create Shiprocket shipment'),
  });

  const refundMutation = useMutation({
    mutationFn: () =>
      adminApi.payments.refund(id, {
        amount: refundAmount ? parseFloat(refundAmount) : undefined,
        reason: refundReason || undefined,
      }),
    onSuccess: () => {
      invalidate();
      toast.success('Refund initiated');
      setRefundOpen(false);
      setRefundAmount('');
      setRefundReason('');
    },
    onError: () => toast.error('Failed to initiate refund'),
  });

  if (isLoading) return <div className="p-6"><TableSkeleton rows={6} cols={4} /></div>;

  if (isError || !order) {
    return (
      <div className="p-6 text-center">
        <p className="text-slate-500 mb-4">Failed to load order details.</p>
        <Button variant="outline" onClick={() => refetch()}>
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      <PageHeader
        title={`Order ${order.orderNumber}`}
        description={`Placed on ${fmtDate(order.createdAt)}`}
        action={
          <Button variant="outline" onClick={() => router.push('/admin/orders')}>
            <ArrowLeft className="w-4 h-4 mr-1" /> Back to Orders
          </Button>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main column */}
        <div className="lg:col-span-2 space-y-5">
          {/* Order Info */}
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-slate-800">Order Information</h2>
              <StatusBadge status={order.status} />
            </div>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
              <div>
                <dt className="text-slate-500">Order Number</dt>
                <dd className="font-mono font-medium">{order.orderNumber}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Payment Status</dt>
                <dd><StatusBadge status={order.payment?.status ?? 'PENDING'} /></dd>
              </div>
              <div>
                <dt className="text-slate-500">Payment Method</dt>
                <dd>{order.payment?.method ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Date</dt>
                <dd>{fmtDate(order.createdAt)}</dd>
              </div>
            </dl>
          </div>

          {/* Items */}
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h2 className="font-semibold text-slate-800 mb-4">Items ({order.items.length})</h2>
            <div className="divide-y divide-slate-100">
              {order.items.map((item) => (
                <div key={item.id} className="flex items-center gap-3 py-3">
                  {item.image ? (
                    <img
                      src={item.image}
                      alt={item.name}
                      className="w-12 h-12 rounded-md object-cover border border-slate-200"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-md bg-slate-100 flex items-center justify-center text-slate-300 text-xs">
                      No img
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{item.name}</p>
                    <p className="text-xs text-slate-400">SKU: {item.sku ?? '—'}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-medium">₹{Number(item.price ?? 0).toLocaleString('en-IN')}</p>
                    <p className="text-xs text-slate-400">× {item.quantity}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="border-t border-slate-100 pt-3 mt-2 space-y-1.5 text-sm">
              <div className="flex justify-between text-slate-600">
                <span>Subtotal</span>
                <span>₹{Number(order.subtotal ?? 0).toLocaleString('en-IN')}</span>
              </div>
              {Number(order.discountAmount ?? 0) > 0 && (
                <div className="flex justify-between text-green-600">
                  <span>Discount {order.coupon?.code ? `(${order.coupon.code})` : ''}</span>
                  <span>−₹{Number(order.discountAmount ?? 0).toLocaleString('en-IN')}</span>
                </div>
              )}
              <div className="flex justify-between text-slate-600">
                <span>Shipping</span>
                <span>
                  {Number(order.shippingCharge ?? 0) === 0
                    ? 'Free'
                    : `₹${Number(order.shippingCharge ?? 0).toLocaleString('en-IN')}`}
                </span>
              </div>
              <div className="flex justify-between font-semibold text-slate-900 pt-1 border-t border-slate-100">
                <span>Total</span>
                <span>₹{Number(order.total ?? 0).toLocaleString('en-IN')}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-5">
          {/* Customer */}
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h2 className="font-semibold text-slate-800 mb-3">Customer</h2>
            <div className="space-y-1 text-sm">
              <p className="font-medium">{order.user.name}</p>
              {order.user.email && <p className="text-slate-500">{order.user.email}</p>}
              {order.user.phone && <p className="text-slate-500">{order.user.phone}</p>}
            </div>
          </div>

          {/* Delivery Address */}
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h2 className="font-semibold text-slate-800 mb-3">Delivery Address</h2>
            <div className="text-sm text-slate-600 space-y-0.5">
              <p className="font-medium text-slate-800">{order.address.name}</p>
              <p>{order.address.phone}</p>
              <p>{order.address.line1}</p>
              {order.address.line2 && <p>{order.address.line2}</p>}
              <p>
                {order.address.city}, {order.address.state} {order.address.pincode}
              </p>
            </div>
          </div>

          {/* Delivery Info */}
          {order.delivery && (order.delivery.agent || order.delivery.awbCode) && (
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <h2 className="font-semibold text-slate-800 mb-3">
                {order.delivery.type === 'THIRD_PARTY' ? 'Shiprocket Shipment' : 'Delivery Agent'}
              </h2>
              <div className="text-sm text-slate-600 space-y-1">
                {order.delivery.agent?.user?.name && (
                  <p className="font-medium text-slate-800">{order.delivery.agent.user.name}</p>
                )}
                {order.delivery.agent?.user?.phone && <p>{order.delivery.agent.user.phone}</p>}
                {order.delivery.provider && (
                  <p className="text-xs text-slate-500">Provider: {order.delivery.provider}</p>
                )}
                {order.delivery.awbCode && (
                  <p className="font-mono text-xs bg-slate-50 rounded px-2 py-1">AWB: {order.delivery.awbCode}</p>
                )}
                {order.delivery.trackingUrl && (
                  <a
                    href={order.delivery.trackingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
                  >
                    Track Shipment <ExternalLink className="w-3 h-3" />
                  </a>
                )}
                {order.delivery.estimatedAt && (
                  <p>ETA: {fmtDate(order.delivery.estimatedAt)}</p>
                )}
              </div>
            </div>
          )}

          {/* Update Status */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-3">
            <h2 className="font-semibold text-slate-800">Update Status</h2>
            <Select value={newStatus} onValueChange={(v) => setNewStatus(v as OrderStatus)}>
              <SelectTrigger>
                <SelectValue placeholder="Select new status" />
              </SelectTrigger>
              <SelectContent>
                {(VALID_NEXT_STATUSES[order.status as OrderStatus] ?? []).map((s) => (
                  <SelectItem key={s} value={s}>
                    {s.charAt(0) + s.slice(1).toLowerCase()}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              className="w-full"
              disabled={!newStatus || statusMutation.isPending}
              onClick={() => statusMutation.mutate()}
            >
              {statusMutation.isPending ? 'Updating...' : 'Confirm Status'}
            </Button>
          </div>

          {/* Assign Delivery Agent */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-3">
            <h2 className="font-semibold text-slate-800">Assign Delivery</h2>
            <div className="space-y-2">
              <Label className="text-xs">Agent</Label>
              <Select value={agentId} onValueChange={setAgentId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select agent" />
                </SelectTrigger>
                <SelectContent>
                  {agents.map((agent) => (
                    <SelectItem key={agent.id} value={agent.id}>
                      {agent.user?.name ?? 'Agent'} {agent.isOnline ? '(Online)' : '(Offline)'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Label className="text-xs">Tracking Number</Label>
              <Input
                placeholder="TRK12345"
                value={trackingNumber}
                onChange={(e) => setTrackingNumber(e.target.value)}
              />
            </div>
            <Button
              variant="outline"
              className="w-full"
              disabled={(!agentId && !trackingNumber) || deliveryMutation.isPending}
              onClick={() => deliveryMutation.mutate()}
            >
              {deliveryMutation.isPending ? 'Saving...' : 'Save Delivery Info'}
            </Button>
          </div>

          {/* Ship via Shiprocket */}
          {!order.delivery?.awbCode && ['CONFIRMED', 'PROCESSING', 'SHIPPED'].includes(order.status) && (
            <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-3">
              <h2 className="font-semibold text-slate-800">Ship via Shiprocket</h2>
              <p className="text-xs text-slate-500">
                Auto-assigns the best courier and generates a tracking AWB via Shiprocket.
              </p>
              <Button
                className="w-full"
                disabled={shiprocketMutation.isPending}
                onClick={() => shiprocketMutation.mutate()}
              >
                <Package className="w-4 h-4 mr-2" />
                {shiprocketMutation.isPending ? 'Creating Shipment...' : 'Create Shiprocket Shipment'}
              </Button>
            </div>
          )}

          {/* Refund */}
          {['PAID', 'SUCCESS', 'PARTIALLY_REFUNDED'].includes(order.payment?.status ?? '') && (
            <Button
              variant="outline"
              className="w-full text-red-600 border-red-200 hover:bg-red-50"
              onClick={() => setRefundOpen(true)}
            >
              <RefreshCw className="w-4 h-4 mr-2" /> Initiate Refund
            </Button>
          )}
        </div>
      </div>

      {/* Refund Dialog */}
      <Dialog open={refundOpen} onOpenChange={(o) => !o && setRefundOpen(false)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Initiate Refund</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label>Refund Amount (₹)</Label>
              <Input
                type="number"
                step="0.01"
                placeholder={`Max ₹${Number(order.total ?? 0).toLocaleString('en-IN')}`}
                value={refundAmount}
                onChange={(e) => setRefundAmount(e.target.value)}
              />
              <p className="text-xs text-slate-400">Leave blank for full refund</p>
            </div>
            <div className="space-y-1">
              <Label>Reason</Label>
              <Input
                placeholder="Reason for refund"
                value={refundReason}
                onChange={(e) => setRefundReason(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRefundOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => refundMutation.mutate()}
              disabled={refundMutation.isPending}
            >
              {refundMutation.isPending ? 'Processing...' : 'Confirm Refund'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
