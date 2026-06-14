'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Trash2, ShoppingBag, ArrowRight, Minus, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { MainLayout } from '@/components/layout/MainLayout';
import { useCartStore } from '@/store/cartStore';
import { useAuthStore } from '@/store/authStore';
import { formatPrice } from '@/lib/utils';

export default function CartPage() {
  const { items, updateQuantity, removeItem, subtotal, totalItems } = useCartStore();
  const { isAuthenticated } = useAuthStore();

  const sub            = subtotal();
  const shippingCharge = sub >= 999 ? 0 : 49;
  const total          = sub + shippingCharge;

  if (items.length === 0) {
    return (
      <MainLayout>
        <div className="container py-16 text-center max-w-md mx-auto">
          <ShoppingBag className="h-16 w-16 text-muted-foreground/30 mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2">Your cart is empty</h1>
          <p className="text-muted-foreground mb-6">Looks like you haven't added any jewellery yet.</p>
          <Button asChild size="lg">
            <Link href="/products">Start Shopping <ArrowRight className="h-4 w-4 ml-2" /></Link>
          </Button>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="container py-8 max-w-5xl">
        <h1 className="text-2xl font-bold mb-6">Shopping Cart ({totalItems()} item{totalItems() !== 1 ? 's' : ''})</h1>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Items */}
          <div className="lg:col-span-2 space-y-4">
            {items.map((item) => (
              <div key={item.variantId} className="flex gap-4 p-4 border rounded-lg bg-card">
                <div className="relative w-20 h-20 rounded-md overflow-hidden bg-gray-50 shrink-0">
                  <Image src={item.image} alt={item.name} fill className="object-cover" sizes="80px" />
                </div>
                <div className="flex-1 min-w-0">
                  <Link href={`/products/${item.slug}`} className="font-medium text-sm hover:text-primary line-clamp-2">
                    {item.name}
                  </Link>
                  <div className="text-xs text-muted-foreground mt-0.5 space-x-2">
                    {item.size && <span>Size: {item.size}</span>}
                    {item.color && <span>Color: {item.color}</span>}
                    <span>SKU: {item.sku}</span>
                  </div>
                  <div className="flex items-center justify-between mt-3">
                    {/* Quantity */}
                    <div className="flex items-center border rounded-md h-8">
                      <button
                        onClick={() => updateQuantity(item.variantId, item.quantity - 1)}
                        className="px-2 hover:bg-muted transition-colors rounded-l-md h-full"
                        disabled={item.quantity <= 1}
                      >
                        <Minus className="h-3 w-3" />
                      </button>
                      <span className="px-3 text-sm font-medium">{item.quantity}</span>
                      <button
                        onClick={() => updateQuantity(item.variantId, item.quantity + 1)}
                        className="px-2 hover:bg-muted transition-colors rounded-r-md h-full"
                        disabled={item.quantity >= item.stock}
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-semibold text-primary">
                        {formatPrice(item.price * item.quantity)}
                      </span>
                      <button
                        onClick={() => removeItem(item.variantId)}
                        className="text-muted-foreground hover:text-destructive transition-colors"
                        aria-label="Remove item"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Summary */}
          <div className="lg:col-span-1">
            <div className="border rounded-lg p-5 bg-card sticky top-24 space-y-4">
              <h2 className="font-semibold text-lg">Order Summary</h2>
              <Separator />

              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>{formatPrice(sub)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Shipping</span>
                  <span className={shippingCharge === 0 ? 'text-green-600 font-medium' : ''}>
                    {shippingCharge === 0 ? 'FREE' : formatPrice(shippingCharge)}
                  </span>
                </div>
                {shippingCharge > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Add {formatPrice(999 - sub)} more for free shipping
                  </p>
                )}
              </div>

              <Separator />
              <div className="flex justify-between font-bold">
                <span>Total</span>
                <span className="text-primary text-lg">{formatPrice(total)}</span>
              </div>

              <Button className="w-full h-11" asChild>
                <Link href={isAuthenticated ? '/checkout' : '/auth/login?redirect=/checkout'}>
                  Proceed to Checkout <ArrowRight className="h-4 w-4 ml-2" />
                </Link>
              </Button>

              <Button variant="outline" className="w-full" asChild>
                <Link href="/products">Continue Shopping</Link>
              </Button>

              <p className="text-xs text-center text-muted-foreground">
                🔒 Secure checkout powered by Razorpay
              </p>
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
