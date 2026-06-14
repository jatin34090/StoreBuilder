'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Loader2, Phone, Lock, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { authApi, cartApi } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { useCartStore } from '@/store/cartStore';

// ─── Schemas ──────────────────────────────────────────────────────────────────

const otpRequestSchema = z.object({
  phone: z.string().regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit Indian mobile number'),
});

const otpVerifySchema = z.object({
  otp: z.string().length(6, 'OTP must be 6 digits'),
});

const loginSchema = z.object({
  identifier: z.string().min(1, 'Email or phone is required'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

type OtpRequestForm = z.infer<typeof otpRequestSchema>;
type OtpVerifyForm = z.infer<typeof otpVerifySchema>;
type LoginForm = z.infer<typeof loginSchema>;

// ─── Component ────────────────────────────────────────────────────────────────

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get('redirect') ?? '/';
  const { setUser } = useAuthStore();
  const { items, clearCart } = useCartStore();
  const [otpSent, setOtpSent] = useState(false);
  const [phone, setPhone] = useState('');

  // Merge guest cart after login
  const mergeGuestCart = async () => {
    if (items.length === 0) return;
    try {
      await cartApi.merge(items.map((i) => ({ variantId: i.variantId, quantity: i.quantity })));
      clearCart();
    } catch {
      /* non-critical */
    }
  };

  const onLoginSuccess = async (user: { id: string; name: string; email?: string; phone?: string; role: 'CUSTOMER' | 'ADMIN' | 'DELIVERY_AGENT' }) => {
    setUser(user);
    await mergeGuestCart();
    toast.success(`Welcome back, ${user.name.split(' ')[0]}!`);
    router.push(redirectTo);
  };

  // ─── OTP flow ──────────────────────────────────────────────────────────────

  const otpRequestForm = useForm<OtpRequestForm>({ resolver: zodResolver(otpRequestSchema) });
  const otpVerifyForm = useForm<OtpVerifyForm>({ resolver: zodResolver(otpVerifySchema) });

  const handleSendOtp = otpRequestForm.handleSubmit(async (data) => {
    try {
      await authApi.sendOtp(data.phone);
      setPhone(data.phone);
      setOtpSent(true);
      toast.success(`OTP sent to +91 ${data.phone}`);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg ?? 'Failed to send OTP. Please try again.');
    }
  });

  const handleVerifyOtp = otpVerifyForm.handleSubmit(async (data) => {
    try {
      const res = await authApi.verifyOtp(phone, data.otp);
      await onLoginSuccess(res.data.data?.user);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg ?? 'Invalid OTP. Please try again.');
    }
  });

  // ─── Password flow ─────────────────────────────────────────────────────────

  const loginForm = useForm<LoginForm>({ resolver: zodResolver(loginSchema) });

  const handleLogin = loginForm.handleSubmit(async (data) => {
    try {
      const res = await authApi.login(data.identifier, data.password);
      await onLoginSuccess(res.data.data?.user);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg ?? 'Invalid credentials. Please try again.');
    }
  });

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center py-12 px-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 mb-4">
            <span className="text-2xl">💎</span>
          </div>
          <h1 className="text-2xl font-bold text-foreground">Welcome back</h1>
          <p className="text-muted-foreground mt-1">Sign in to your YourBrand account</p>
        </div>

        <div className="bg-card border rounded-xl p-6 shadow-sm">
          <Tabs defaultValue="otp">
            <TabsList className="w-full mb-6">
              <TabsTrigger value="otp" className="flex-1">📱 OTP Login</TabsTrigger>
              <TabsTrigger value="password" className="flex-1">🔒 Password</TabsTrigger>
            </TabsList>

            {/* ─── OTP Tab ─────────────────────────────────────────────── */}
            <TabsContent value="otp">
              {!otpSent ? (
                <form onSubmit={handleSendOtp} className="space-y-4">
                  <div>
                    <Label htmlFor="phone">Mobile Number</Label>
                    <div className="flex mt-1.5">
                      <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-input bg-muted text-muted-foreground text-sm">
                        +91
                      </span>
                      <Input
                        id="phone"
                        type="tel"
                        inputMode="numeric"
                        maxLength={10}
                        placeholder="9876543210"
                        className="rounded-l-none"
                        {...otpRequestForm.register('phone')}
                      />
                    </div>
                    {otpRequestForm.formState.errors.phone && (
                      <p className="text-destructive text-xs mt-1">
                        {otpRequestForm.formState.errors.phone.message}
                      </p>
                    )}
                  </div>
                  <Button
                    type="submit"
                    className="w-full"
                    disabled={otpRequestForm.formState.isSubmitting}
                  >
                    {otpRequestForm.formState.isSubmitting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>Send OTP <ArrowRight className="h-4 w-4 ml-1" /></>
                    )}
                  </Button>
                </form>
              ) : (
                <form onSubmit={handleVerifyOtp} className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    OTP sent to <span className="font-medium text-foreground">+91 {phone}</span>.{' '}
                    <button
                      type="button"
                      onClick={() => setOtpSent(false)}
                      className="text-primary underline text-xs"
                    >
                      Change
                    </button>
                  </p>
                  <div>
                    <Label htmlFor="otp">Enter 6-digit OTP</Label>
                    <Input
                      id="otp"
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      placeholder="• • • • • •"
                      className="mt-1.5 text-center tracking-[0.5em] text-lg"
                      {...otpVerifyForm.register('otp')}
                    />
                    {otpVerifyForm.formState.errors.otp && (
                      <p className="text-destructive text-xs mt-1">
                        {otpVerifyForm.formState.errors.otp.message}
                      </p>
                    )}
                  </div>
                  <Button
                    type="submit"
                    className="w-full"
                    disabled={otpVerifyForm.formState.isSubmitting}
                  >
                    {otpVerifyForm.formState.isSubmitting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      'Verify & Sign In'
                    )}
                  </Button>
                  <button
                    type="button"
                    onClick={() => handleSendOtp()}
                    className="w-full text-xs text-muted-foreground hover:text-primary underline"
                  >
                    Didn't receive OTP? Resend
                  </button>
                </form>
              )}
            </TabsContent>

            {/* ─── Password Tab ─────────────────────────────────────────── */}
            <TabsContent value="password">
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <Label htmlFor="identifier">Email or Phone</Label>
                  <div className="relative mt-1.5">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="identifier"
                      placeholder="email@example.com or 9876543210"
                      className="pl-9"
                      {...loginForm.register('identifier')}
                    />
                  </div>
                  {loginForm.formState.errors.identifier && (
                    <p className="text-destructive text-xs mt-1">
                      {loginForm.formState.errors.identifier.message}
                    </p>
                  )}
                </div>
                <div>
                  <Label htmlFor="password">Password</Label>
                  <div className="relative mt-1.5">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="password"
                      type="password"
                      placeholder="••••••••"
                      className="pl-9"
                      {...loginForm.register('password')}
                    />
                  </div>
                  {loginForm.formState.errors.password && (
                    <p className="text-destructive text-xs mt-1">
                      {loginForm.formState.errors.password.message}
                    </p>
                  )}
                </div>
                <Button
                  type="submit"
                  className="w-full"
                  disabled={loginForm.formState.isSubmitting}
                >
                  {loginForm.formState.isSubmitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    'Sign In'
                  )}
                </Button>
              </form>
            </TabsContent>
          </Tabs>

          {/* Google OAuth */}
          <div className="mt-4 relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">or</span>
            </div>
          </div>
          <Button
            variant="outline"
            className="w-full mt-4"
            onClick={() => (window.location.href = `${process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001/api/v1'}/auth/google`)}
          >
            <svg className="h-4 w-4 mr-2" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Continue with Google
          </Button>
        </div>

        <p className="text-center text-sm text-muted-foreground mt-6">
          New to YourBrand?{' '}
          <Link href="/auth/login" className="text-primary font-medium hover:underline">
            Create an account
          </Link>
        </p>
      </div>
    </div>
  );
}
