'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams, useParams } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckCircle, Package, Truck, MapPin, ArrowLeft, Loader2, XCircle, KeyRound } from 'lucide-react';
import { toast } from 'sonner';
import { MainLayout } from '@/components/layout/MainLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuthGuard } from '@/hooks/useAuthGuard';
import { ordersApi, notificationsApi } from '@/lib/api';
import { formatPrice, formatDate, cn } from '@/lib/utils';

const STATUS_STEPS = ['CONFIRMED', 'PROCESSING', 'SHIPPED', 'OUT_FOR_DELIVERY', 'DELIVERED'];

function OrderDetailPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const params = useParams<{ id: string }>();
  const isSuccess = searchParams.get('success') === 'true';
  const { isAuthenticated, hydrated } = useAuthGuard('/auth/login');
  const queryClient = useQueryClient();

  useEffect(() => {
    if (isSuccess) toast.success('🎉 Order placed successfully!');
  }, [isSuccess]);

  const { data, isLoading } = useQuery({
    queryKey: ['order', params.id],
    queryFn: () => ordersApi.get(params.id),
    enabled: isAuthenticated,
  });

  const order = data?.data?.data;

  // Fetch delivery OTP notification when order is out for delivery
  const { data: notifData } = useQuery({
    queryKey: ['notifications', 'delivery-otp', params.id],
    queryFn: () => notificationsApi.list({ limit: 50 }),
    enabled: isAuthenticated && order?.status === 'OUT_FOR_DELIVERY',
    refetchInterval: 15_000,
  });

  const deliveryOtp = (() => {
    const notifs: Array<{ type: string; data?: Record<string, unknown> }> =
      notifData?.data?.data?.notifications ?? [];
    const match = notifs.find(
      (n) => n.type === 'DELIVERY' && n.data?.orderId === params.id && n.data?.otp,
    );
    return match?.data?.otp as string | undefined;
  })();

  const cancelMutation = useMutation({
    mutationFn: () => ordersApi.cancel(params.id, 'Customer requested cancellation'),
    onSuccess: () => {
      toast.success('Order cancelled');
      queryClient.invalidateQueries({ queryKey: ['order', params.id] });
    },
    onError: () => toast.error('Could not cancel order'),
  });

  if (isLoading) {
    return (
      <MainLayout>
        <div className="container py-8 max-w-2xl space-y-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      </MainLayout>
    );
  }

  if (!order) {
    return (
      <MainLayout>
        <div className="container py-16 text-center">
          <p className="text-muted-foreground">Order not found.</p>
          <Button asChild className="mt-4"><Link href="/account/orders">View Orders</Link></Button>
        </div>
      </MainLayout>
    );
  }

  const currentStepIdx = STATUS_STEPS.indexOf(order.status);
  const isCancellable  = ['PENDING', 'CONFIRMED'].includes(order.status);
  const isDelivered    = order.status === 'DELIVERED';

  if (!hydrated || !isAuthenticated) return null;

  return (
    <MainLayout>
      <div className="container py-8 max-w-2xl">
        <Link href="/account/orders" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary mb-4">
          <ArrowLeft className="h-4 w-4" /> Back to orders
        </Link>

        {isSuccess && (
          <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-xl mb-6">
            <CheckCircle className="h-6 w-6 text-green-600 shrink-0" />
            <div>
              <p className="font-semibold text-green-800">Order confirmed!</p>
              <p className="text-sm text-green-700">You'll receive updates via notifications.</p>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold">{order.orderNumber}</h1>
            <p className="text-sm text-muted-foreground">{formatDate(order.createdAt)}</p>
          </div>
          <Badge variant={isDelivered ? 'success' : order.status === 'CANCELLED' ? 'destructive' : 'default'}>
            {order.status.replace(/_/g, ' ')}
          </Badge>
        </div>

        {/* Progress tracker */}
        {!['CANCELLED', 'RETURNED', 'REFUNDED'].includes(order.status) && (
          <div className="border rounded-xl p-5 bg-card mb-4">
            <h2 className="font-semibold text-sm mb-4 flex items-center gap-2"><Truck className="h-4 w-4 text-primary" /> Delivery Status</h2>
            <div className="flex items-center gap-0">
              {STATUS_STEPS.map((step, idx) => {
                const done   = idx <= currentStepIdx;
                const active = idx === currentStepIdx;
                return (
                  <div key={step} className="flex items-center flex-1 last:flex-none">
                    <div className={cn('w-7 h-7 rounded-full border-2 flex items-center justify-center text-xs font-bold transition-colors shrink-0',
                      done ? 'bg-primary border-primary text-primary-foreground' : 'border-muted text-muted-foreground')}>
                      {done ? '✓' : idx + 1}
                    </div>
                    {idx < STATUS_STEPS.length - 1 && (
                      <div className={cn('flex-1 h-0.5 mx-1', idx < currentStepIdx ? 'bg-primary' : 'bg-muted')} />
                    )}
                  </div>
                );
              })}
            </div>
            <div className="flex justify-between mt-2">
              {STATUS_STEPS.map((step) => (
                <span key={step} className="text-[9px] text-muted-foreground text-center flex-1 leading-tight">
                  {step.replace(/_/g, ' ')}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Third-party tracking (Shiprocket) — in-portal timeline */}
        {order.delivery?.type === 'THIRD_PARTY' && order.delivery?.awbCode && (
          <div className="border rounded-xl p-5 bg-card mb-4">
            <h2 className="font-semibold text-sm mb-4 flex items-center gap-2">
              <Truck className="h-4 w-4 text-primary" /> Shipment Tracking
            </h2>

            {/* Status timeline */}
            {(() => {
              const DELIVERY_STEPS = [
                { key: 'ASSIGNED',         label: 'Shipment Booked',      icon: Package },
                { key: 'PICKED_UP',        label: 'Picked Up',            icon: CheckCircle },
                { key: 'IN_TRANSIT',       label: 'In Transit',           icon: Truck },
                { key: 'OUT_FOR_DELIVERY', label: 'Out for Delivery',     icon: MapPin },
                { key: 'DELIVERED',        label: 'Delivered',            icon: CheckCircle },
              ];
              const currentIdx = DELIVERY_STEPS.findIndex(s => s.key === order.delivery?.status);
              return (
                <div className="space-y-3 mb-4">
                  {DELIVERY_STEPS.map((step, idx) => {
                    const done    = currentIdx >= idx;
                    const active  = currentIdx === idx;
                    const Icon    = step.icon;
                    return (
                      <div key={step.key} className="flex items-start gap-3">
                        <div className="flex flex-col items-center">
                          <div className={cn(
                            'w-7 h-7 rounded-full flex items-center justify-center shrink-0 transition-colors',
                            done ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
                          )}>
                            <Icon className="h-3.5 w-3.5" />
                          </div>
                          {idx < DELIVERY_STEPS.length - 1 && (
                            <div className={cn('w-0.5 h-5 mt-1', idx < currentIdx ? 'bg-primary' : 'bg-muted')} />
                          )}
                        </div>
                        <div className="pt-0.5">
                          <p className={cn('text-sm font-medium', done ? 'text-foreground' : 'text-muted-foreground')}>
                            {step.label}
                          </p>
                          {active && (
                            <p className="text-xs text-primary font-medium">Current status</p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}

            {/* Shipment details */}
            <div className="border-t pt-3 space-y-1.5 text-sm">
              {order.delivery.provider && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Courier</span>
                  <span className="font-medium">{order.delivery.provider.replace('shiprocket:', '')}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">AWB Number</span>
                <span className="font-mono text-xs">{order.delivery.awbCode}</span>
              </div>
              {order.delivery.estimatedAt && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Est. Delivery</span>
                  <span>{formatDate(order.delivery.estimatedAt)}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Delivery OTP box */}
        {order.status === 'OUT_FOR_DELIVERY' && order.delivery?.type !== 'THIRD_PARTY' && (
          <div className="border-2 border-orange-400 rounded-xl p-5 bg-orange-50 mb-4">
            <div className="flex items-center gap-2 mb-3">
              <KeyRound className="h-5 w-5 text-orange-600 shrink-0" />
              <p className="font-semibold text-orange-800">Delivery OTP</p>
            </div>
            {deliveryOtp ? (
              <>
                <p className="text-sm text-orange-700 mb-3">
                  Your delivery agent is at your door. Share this OTP to confirm delivery.
                </p>
                <div className="flex items-center justify-center bg-white border-2 border-orange-300 rounded-xl py-4 px-6">
                  <span className="text-4xl font-bold tracking-[0.5em] text-orange-600 select-all">
                    {deliveryOtp}
                  </span>
                </div>
                <p className="text-xs text-orange-600 mt-2 text-center">
                  Share only with the delivery agent. Do not share with anyone else.
                </p>
              </>
            ) : (
              <p className="text-sm text-orange-700">
                Your order is out for delivery! Your OTP will appear here shortly.
              </p>
            )}
          </div>
        )}

        {/* Items */}
        <div className="border rounded-xl p-5 bg-card mb-4 space-y-3">
          <h2 className="font-semibold text-sm flex items-center gap-2"><Package className="h-4 w-4 text-primary" /> Items</h2>
          {order.items.map((item: { id: string; name: string; sku: string; quantity: number; price: number; image: string }) => (
            <div key={item.id} className="flex gap-3">
              <div className="relative w-14 h-14 rounded-md overflow-hidden bg-gray-50 shrink-0">
                <Image src={item.image} alt={item.name} fill className="object-cover" sizes="56px" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium line-clamp-1">{item.name}</p>
                <p className="text-xs text-muted-foreground">SKU: {item.sku} · Qty: {item.quantity}</p>
              </div>
              <span className="text-sm font-semibold">{formatPrice(Number(item.price) * item.quantity)}</span>
            </div>
          ))}
        </div>

        {/* Address */}
        <div className="border rounded-xl p-5 bg-card mb-4">
          <h2 className="font-semibold text-sm mb-2 flex items-center gap-2"><MapPin className="h-4 w-4 text-primary" /> Delivery Address</h2>
          <p className="text-sm">{order.address?.name} · {order.address?.phone}</p>
          <p className="text-sm text-muted-foreground">{order.address?.line1}, {order.address?.city}, {order.address?.state} — {order.address?.pincode}</p>
        </div>

        {/* Payment summary */}
        <div className="border rounded-xl p-5 bg-card mb-6 space-y-2 text-sm">
          <h2 className="font-semibold mb-1">Payment</h2>
          <div className="flex justify-between"><span className="text-muted-foreground">Method</span><span>{order.payment?.method?.replace(/_/g, ' ')} via {order.payment?.gateway}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Status</span><Badge variant={order.payment?.status === 'SUCCESS' ? 'success' : 'secondary'} className="text-xs">{order.payment?.status}</Badge></div>
          <Separator />
          <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{formatPrice(order.subtotal)}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Shipping</span><span>{Number(order.shippingCharge) === 0 ? 'FREE' : formatPrice(order.shippingCharge)}</span></div>
          {Number(order.discountAmount) > 0 && <div className="flex justify-between text-green-600"><span>Discount</span><span>-{formatPrice(order.discountAmount)}</span></div>}
          <Separator />
          <div className="flex justify-between font-bold text-base"><span>Total</span><span className="text-primary">{formatPrice(order.total)}</span></div>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          {isCancellable && (
            <Button
              variant="destructive"
              onClick={() => cancelMutation.mutate()}
              disabled={cancelMutation.isPending}
            >
              {cancelMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <><XCircle className="h-4 w-4 mr-1.5" /> Cancel Order</>}
            </Button>
          )}
          {isDelivered && (
            <Button variant="outline" asChild>
              <Link href={`/products`}>Buy Again</Link>
            </Button>
          )}
        </div>
      </div>
    </MainLayout>
  );
}

export default function OrderDetailPage() {
  return (
    <Suspense fallback={<MainLayout><div className="container py-8 max-w-2xl space-y-4"><div className="h-8 w-48 bg-muted animate-pulse rounded" /><div className="h-32 w-full bg-muted animate-pulse rounded" /></div></MainLayout>}>
      <OrderDetailPageContent />
    </Suspense>
  );
}
