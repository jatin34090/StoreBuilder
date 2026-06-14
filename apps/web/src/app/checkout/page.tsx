'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Loader2, MapPin, Plus, Tag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { MainLayout } from '@/components/layout/MainLayout';
import { useCartStore } from '@/store/cartStore';
import { useAuthStore } from '@/store/authStore';
import { usersApi, ordersApi, couponsApi } from '@/lib/api';
import { formatPrice } from '@/lib/utils';
import { cn } from '@/lib/utils';

declare global {
  interface Window {
    Razorpay: new (options: Record<string, unknown>) => { open: () => void };
  }
}

const PAYMENT_METHODS = [
  { id: 'UPI',        label: 'UPI',          icon: '📲' },
  { id: 'CARD',       label: 'Card',         icon: '💳' },
  { id: 'NETBANKING', label: 'Net Banking',  icon: '🏦' },
  { id: 'COD',        label: 'Cash on Delivery', icon: '💵' },
];

const addressSchema = z.object({
  name: z.string().min(2, 'Name is required'),
  phone: z.string().regex(/^[6-9]\d{9}$/, 'Valid 10-digit phone required'),
  line1: z.string().min(5, 'Address is required'),
  line2: z.string().optional(),
  city: z.string().min(2, 'City is required'),
  state: z.string().min(2, 'State is required'),
  pincode: z.string().regex(/^\d{6}$/, '6-digit pincode required'),
});

type AddressForm = z.infer<typeof addressSchema>;

export default function CheckoutPage() {
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();
  const { items, subtotal, clearCart } = useCartStore();

  const [selectedAddressId, setSelectedAddressId] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState('UPI');
  const [couponCode, setCouponCode] = useState('');
  const [couponData, setCouponData] = useState<{ code: string; discountAmount: number } | null>(null);
  const [couponLoading, setCouponLoading] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [addAddressOpen, setAddAddressOpen] = useState(false);

  const sub = subtotal();
  const shippingCharge = sub >= 999 ? 0 : 49;
  const discountAmount = couponData?.discountAmount ?? 0;
  const total = Math.max(0, sub + shippingCharge - discountAmount);

  // Redirect if not authenticated or cart is empty
  useEffect(() => {
    if (!isAuthenticated) { router.replace('/auth/login?redirect=/checkout'); return; }
    if (items.length === 0) { router.replace('/cart'); }
  }, [isAuthenticated, items, router]);

  const { data: addressesData, refetch: refetchAddresses } = useQuery({
    queryKey: ['addresses'],
    queryFn: () => usersApi.addresses(),
    enabled: isAuthenticated,
  });
  const addresses: Array<{ id: string; name: string; line1: string; line2?: string; city: string; state: string; pincode: string; phone: string; isDefault: boolean }> = addressesData?.data?.data ?? [];

  useEffect(() => {
    if (addresses.length > 0 && !selectedAddressId) {
      const def = addresses.find((a) => a.isDefault) ?? addresses[0];
      if (def) setSelectedAddressId(def.id);
    }
  }, [addresses, selectedAddressId]);

  // ─── Coupon ───────────────────────────────────────────────────────────────

  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) return;
    setCouponLoading(true);
    try {
      const res = await couponsApi.validate(couponCode.trim().toUpperCase(), sub);
      const data = res.data.data;
      setCouponData({ code: data.coupon.code, discountAmount: data.discountAmount });
      toast.success(`Coupon applied! You save ${formatPrice(data.discountAmount)}`);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg ?? 'Invalid coupon code');
    } finally {
      setCouponLoading(false);
    }
  };

  // ─── Address form ─────────────────────────────────────────────────────────

  const addressForm = useForm<AddressForm>({ resolver: zodResolver(addressSchema) });
  const handleAddAddress = addressForm.handleSubmit(async (data) => {
    try {
      const res = await usersApi.addAddress(data);
      await refetchAddresses();
      setSelectedAddressId(res.data.data?.id);
      setAddAddressOpen(false);
      toast.success('Address added');
    } catch { toast.error('Could not save address'); }
  });

  // ─── Place order ──────────────────────────────────────────────────────────

  const handlePlaceOrder = async () => {
    if (!selectedAddressId) { toast.error('Please select a delivery address'); return; }
    if (items.length === 0) { toast.error('Your cart is empty'); return; }

    setPlacing(true);
    try {
      const res = await ordersApi.place({
        addressId: selectedAddressId,
        paymentMethod,
        deliveryType: 'SELF',
        couponCode: couponData?.code,
        items: items.map((i) => ({ variantId: i.variantId, quantity: i.quantity })),
      });
      const { order, payment } = res.data.data;

      if (paymentMethod === 'COD') {
        clearCart();
        toast.success('Order placed successfully! 🎉');
        router.push(`/account/orders/${order.id}?success=true`);
        return;
      }

      // Razorpay payment
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      document.body.appendChild(script);
      script.onload = () => {
        const rzp = new window.Razorpay({
          key: payment.razorpayKeyId,
          order_id: payment.razorpayOrderId,
          amount: total * 100,
          currency: 'INR',
          name: 'YourBrand Jewellery',
          description: `Order ${order.orderNumber}`,
          handler: async (response: { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string }) => {
            try {
              await ordersApi.verifyPayment(order.id, {
                razorpayPaymentId: response.razorpay_payment_id,
                razorpayOrderId:   response.razorpay_order_id,
                razorpaySignature: response.razorpay_signature,
              });
              clearCart();
              toast.success('Payment successful! Order confirmed 🎉');
              router.push(`/account/orders/${order.id}?success=true`);
            } catch { toast.error('Payment verification failed. Contact support.'); }
          },
          prefill: {},
          theme: { color: '#4A0E8F' },
          modal: { ondismiss: () => toast.info('Payment cancelled') },
        });
        rzp.open();
      };
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg ?? 'Could not place order. Please try again.');
    } finally {
      setPlacing(false);
    }
  };

  if (!isAuthenticated || items.length === 0) {
    return <MainLayout><div className="container py-20 text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto" /></div></MainLayout>;
  }

  return (
    <MainLayout>
      <div className="container py-8 max-w-5xl">
        <h1 className="text-2xl font-bold mb-6">Checkout</h1>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left */}
          <div className="lg:col-span-2 space-y-6">

            {/* ─── Delivery Address ──────────────────────────────────── */}
            <div className="border rounded-xl p-5 bg-card">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold flex items-center gap-2"><MapPin className="h-4 w-4 text-primary" /> Delivery Address</h2>
                <Dialog open={addAddressOpen} onOpenChange={setAddAddressOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm"><Plus className="h-3.5 w-3.5 mr-1" /> Add New</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader><DialogTitle>Add Delivery Address</DialogTitle></DialogHeader>
                    <form onSubmit={handleAddAddress} className="space-y-3 mt-2">
                      {(['name','phone','line1','line2','city','state','pincode'] as const).map((field) => (
                        <div key={field}>
                          <Label className="capitalize">{field}</Label>
                          <Input className="mt-1" placeholder={field} {...addressForm.register(field)} />
                          {addressForm.formState.errors[field] && (
                            <p className="text-destructive text-xs mt-0.5">{addressForm.formState.errors[field]?.message}</p>
                          )}
                        </div>
                      ))}
                      <Button type="submit" className="w-full" disabled={addressForm.formState.isSubmitting}>
                        {addressForm.formState.isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save Address'}
                      </Button>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>

              {addresses.length === 0 ? (
                <p className="text-muted-foreground text-sm">No addresses saved. Add one above.</p>
              ) : (
                <div className="space-y-2">
                  {addresses.map((addr) => (
                    <label
                      key={addr.id}
                      className={cn(
                        'flex gap-3 p-3 rounded-lg border cursor-pointer transition-colors',
                        selectedAddressId === addr.id ? 'border-primary bg-primary/5' : 'hover:border-muted-foreground',
                      )}
                    >
                      <input
                        type="radio"
                        name="address"
                        value={addr.id}
                        checked={selectedAddressId === addr.id}
                        onChange={() => setSelectedAddressId(addr.id)}
                        className="mt-0.5"
                      />
                      <div className="text-sm">
                        <p className="font-medium">{addr.name} · {addr.phone}</p>
                        <p className="text-muted-foreground">{addr.line1}{addr.line2 ? `, ${addr.line2}` : ''}</p>
                        <p className="text-muted-foreground">{addr.city}, {addr.state} — {addr.pincode}</p>
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>

            {/* ─── Payment Method ─────────────────────────────────────── */}
            <div className="border rounded-xl p-5 bg-card">
              <h2 className="font-semibold mb-4">Payment Method</h2>
              <div className="grid grid-cols-2 gap-2">
                {PAYMENT_METHODS.map((pm) => (
                  <label
                    key={pm.id}
                    className={cn(
                      'flex items-center gap-2.5 p-3 rounded-lg border cursor-pointer transition-colors',
                      paymentMethod === pm.id ? 'border-primary bg-primary/5' : 'hover:border-muted-foreground',
                    )}
                  >
                    <input type="radio" name="payment" value={pm.id} checked={paymentMethod === pm.id} onChange={() => setPaymentMethod(pm.id)} />
                    <span className="text-lg">{pm.icon}</span>
                    <span className="text-sm font-medium">{pm.label}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* Right — Order Summary */}
          <div className="space-y-4">
            <div className="border rounded-xl p-5 bg-card sticky top-24 space-y-4">
              <h2 className="font-semibold">Order Summary</h2>
              <div className="space-y-2 max-h-52 overflow-y-auto scrollbar-hide">
                {items.map((item) => (
                  <div key={item.variantId} className="flex gap-2 text-sm">
                    <div className="relative w-10 h-10 rounded overflow-hidden bg-gray-100 shrink-0">
                      <Image src={item.image} alt={item.name} fill className="object-cover" sizes="40px" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="truncate">{item.name}</p>
                      <p className="text-muted-foreground text-xs">×{item.quantity}</p>
                    </div>
                    <span className="font-medium shrink-0">{formatPrice(item.price * item.quantity)}</span>
                  </div>
                ))}
              </div>

              {/* Coupon */}
              <Separator />
              <div className="flex gap-2">
                <Input
                  placeholder="Coupon code"
                  value={couponCode}
                  onChange={(e) => { setCouponCode(e.target.value.toUpperCase()); setCouponData(null); }}
                  className="h-9 text-sm"
                />
                <Button variant="outline" size="sm" onClick={handleApplyCoupon} disabled={couponLoading || !couponCode}>
                  {couponLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Tag className="h-3.5 w-3.5" />}
                </Button>
              </div>
              {couponData && (
                <p className="text-green-600 text-xs flex items-center gap-1">
                  ✓ {couponData.code} applied — saving {formatPrice(couponData.discountAmount)}
                </p>
              )}

              <Separator />
              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{formatPrice(sub)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Shipping</span><span className={shippingCharge === 0 ? 'text-green-600' : ''}>{shippingCharge === 0 ? 'FREE' : formatPrice(shippingCharge)}</span></div>
                {discountAmount > 0 && <div className="flex justify-between text-green-600"><span>Discount</span><span>-{formatPrice(discountAmount)}</span></div>}
              </div>
              <Separator />
              <div className="flex justify-between font-bold"><span>Total</span><span className="text-primary text-lg">{formatPrice(total)}</span></div>

              <Button className="w-full h-11" onClick={handlePlaceOrder} disabled={placing || !selectedAddressId}>
                {placing ? <Loader2 className="h-4 w-4 animate-spin" /> : `Place Order · ${formatPrice(total)}`}
              </Button>
              <p className="text-xs text-center text-muted-foreground">🔒 Secured by Razorpay</p>
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
