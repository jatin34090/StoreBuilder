'use client';

import { Suspense, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Loader2, User, Mail, Lock, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { authApi, cartApi, api } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { useCartStore } from '@/store/cartStore';

const registerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(80),
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters').max(128),
});

type RegisterForm = z.infer<typeof registerSchema>;

function RegisterPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get('redirect') ?? '/';
  const { setUser } = useAuthStore();
  const { items, clearCart } = useCartStore();
  const [showPassword, setShowPassword] = useState(false);
  const [brandName, setBrandName] = useState('YourBrand');

  useEffect(() => {
    api.get('/settings/site')
      .then((r) => {
        const d = r.data?.data ?? r.data;
        if (d?.brandName) setBrandName(d.brandName as string);
      })
      .catch(() => {});
  }, []);

  const mergeGuestCart = async () => {
    if (items.length === 0) return;
    try {
      await cartApi.merge(items.map((i) => ({ variantId: i.variantId, quantity: i.quantity })));
      clearCart();
    } catch {
      /* non-critical */
    }
  };

  const form = useForm<RegisterForm>({ resolver: zodResolver(registerSchema) });

  const handleRegister = form.handleSubmit(async (data) => {
    try {
      const res = await authApi.register(data.name, data.email, data.password);
      const user = res.data.data?.user;
      setUser({ ...user, storeId: user.storeId ?? undefined });
      await mergeGuestCart();
      toast.success(`Welcome, ${user.name.split(' ')[0]}! Your account is ready.`);
      router.push(redirectTo);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg ?? 'Could not create your account. Please try again.');
    }
  });

  const loginHref = redirectTo && redirectTo !== '/' ? `/auth/login?redirect=${encodeURIComponent(redirectTo)}` : '/auth/login';

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center py-12 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 mb-4">
            <span className="text-2xl">💎</span>
          </div>
          <h1 className="text-2xl font-bold text-foreground">Create your account</h1>
          <p className="text-muted-foreground mt-1">Join {brandName} to track orders and check out faster</p>
        </div>

        <div className="bg-card border rounded-xl p-6 shadow-sm">
          <form onSubmit={handleRegister} className="space-y-4">
            <div>
              <Label htmlFor="name">Full Name</Label>
              <div className="relative mt-1.5">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input id="name" placeholder="Jatin Sharma" className="pl-9" {...form.register('name')} />
              </div>
              {form.formState.errors.name && (
                <p className="text-destructive text-xs mt-1">{form.formState.errors.name.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="email">Email</Label>
              <div className="relative mt-1.5">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input id="email" type="email" placeholder="email@example.com" className="pl-9" {...form.register('email')} />
              </div>
              {form.formState.errors.email && (
                <p className="text-destructive text-xs mt-1">{form.formState.errors.email.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="password">Password</Label>
              <div className="relative mt-1.5">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="At least 8 characters"
                  className="pl-9 pr-10"
                  {...form.register('password')}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {form.formState.errors.password && (
                <p className="text-destructive text-xs mt-1">{form.formState.errors.password.message}</p>
              )}
            </div>

            <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create Account'}
            </Button>
          </form>

          <div className="mt-4 relative">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t" /></div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">or</span>
            </div>
          </div>
          <Button
            variant="outline"
            className="w-full mt-4"
            onClick={() => {
              const returnTo = (redirectTo && redirectTo !== '/') ? redirectTo : window.location.pathname;
              try { sessionStorage.setItem('oauth_return_to', returnTo); } catch { /* private mode */ }
              window.location.href = '/api/v1/auth/google';
            }}
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
          Already have an account?{' '}
          <Link href={loginHref} className="text-primary font-medium hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="min-h-[calc(100vh-4rem)] flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}>
      <RegisterPageContent />
    </Suspense>
  );
}
