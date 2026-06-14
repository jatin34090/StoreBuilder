'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Package, ChevronRight, Loader2 } from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuthStore } from '@/store/authStore';
import { ordersApi } from '@/lib/api';
import { formatPrice, formatDate } from '@/lib/utils';

const STATUS_COLORS: Record<string, 'default' | 'secondary' | 'success' | 'warning' | 'destructive' | 'outline' | 'gold'> = {
  PENDING:          'warning',
  CONFIRMED:        'default',
  PROCESSING:       'default',
  SHIPPED:          'default',
  OUT_FOR_DELIVERY: 'gold',
  DELIVERED:        'success',
  CANCELLED:        'destructive',
  RETURN_REQUESTED: 'warning',
  RETURNED:         'secondary',
  REFUNDED:         'secondary',
};

export default function OrdersPage() {
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();

  useEffect(() => {
    if (!isAuthenticated) router.replace('/auth/login?redirect=/account/orders');
  }, [isAuthenticated, router]);

  const { data, isLoading } = useQuery({
    queryKey: ['orders'],
    queryFn: () => ordersApi.list({ limit: 20 }),
    enabled: isAuthenticated,
  });

  const orders: Array<{
    id: string;
    orderNumber: string;
    status: string;
    total: number;
    createdAt: string;
    items: { name: string; quantity: number; image: string }[];
  }> = data?.data?.data?.orders ?? [];

  return (
    <MainLayout>
      <div className="container py-8 max-w-2xl">
        <h1 className="text-2xl font-bold mb-6 flex items-center gap-2">
          <Package className="h-6 w-6 text-primary" /> My Orders
        </h1>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="border rounded-xl p-4 space-y-2">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-4 w-24" />
              </div>
            ))}
          </div>
        ) : orders.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <Package className="h-12 w-12 mx-auto mb-3 opacity-20" />
            <p className="font-medium">No orders yet</p>
            <p className="text-sm mt-1 mb-4">Your order history will appear here</p>
            <Button asChild><Link href="/products">Start Shopping</Link></Button>
          </div>
        ) : (
          <div className="space-y-3">
            {orders.map((order) => (
              <Link
                key={order.id}
                href={`/account/orders/${order.id}`}
                className="block border rounded-xl p-4 bg-card hover:shadow-md transition-shadow group"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-sm font-semibold">{order.orderNumber}</span>
                      <Badge variant={STATUS_COLORS[order.status] ?? 'secondary'} className="text-xs">
                        {order.status.replace(/_/g, ' ')}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{formatDate(order.createdAt)}</p>
                    <p className="text-sm text-muted-foreground mt-1 line-clamp-1">
                      {order.items.map((i) => `${i.name} ×${i.quantity}`).join(', ')}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-bold text-primary">{formatPrice(order.total)}</span>
                    <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </MainLayout>
  );
}
