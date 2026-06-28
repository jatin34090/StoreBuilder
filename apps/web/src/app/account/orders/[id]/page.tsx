'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams, useParams } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckCircle, Package, Truck, MapPin, ArrowLeft, Loader2, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { MainLayout } from '@/components/layout/MainLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuthStore } from '@/store/authStore';
import { ordersApi } from '@/lib/api';
import { formatPrice, formatDate, cn } from '@/lib/utils';

const STATUS_STEPS = ['CONFIRMED', 'PROCESSING', 'SHIPPED', 'OUT_FOR_DELIVERY', 'DELIVERED'];

function OrderDetailPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const params = useParams<{ id: string }>();
  const isSuccess = searchParams.get('success') === 'true';
  const { isAuthenticated } = useAuthStore();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!isAuthenticated) router.replace('/auth/login');
  }, [isAuthenticated, router]);

  useEffect(() => {
    if (isSuccess) toast.success('🎉 Order placed successfully!');
  }, [isSuccess]);

  const { data, isLoading } = useQuery({
    queryKey: ['order', params.id],
    queryFn: () => ordersApi.get(params.id),
    enabled: isAuthenticated,
  });

  const order = data?.data?.data;

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
