'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Eye, EyeOff, Gem, Lock, Mail } from 'lucide-react';
import { Button } from '../../../../components/ui/button';
import { Input } from '../../../../components/ui/input';
import { Label } from '../../../../components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../../components/ui/card';
import { useAdminAuthStore } from '../../../../store/adminAuthStore';
import { authApi } from '../../../../lib/api';

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

type LoginFormData = z.infer<typeof loginSchema>;

export default function AdminLoginPage() {
  const router = useRouter();
  const { setAdminAuth, isAdminAuthenticated } = useAdminAuthStore();
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [brandName, setBrandName] = useState('YourBrand');

  useEffect(() => {
    if (isAdminAuthenticated) router.replace('/admin');
  }, [isAdminAuthenticated, router]);

  useEffect(() => {
    import('../../../../lib/api').then(({ api }) => {
      api.get('/settings/site')
        .then((r) => {
          const d = r.data?.data ?? r.data;
          if (d?.brandName) setBrandName(d.brandName as string);
        })
        .catch(() => {});
    });
  }, []);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginFormData) => {
    setIsLoading(true);
    try {
      const response = await authApi.login(data.email, data.password);
      const payload = (response.data as { data?: { user?: { id: string; name: string; email: string; role: string; avatar?: string } }; user?: { id: string; name: string; email: string; role: string; avatar?: string } });
      const user = payload.data?.user ?? payload.user;

      if (!user) {
        toast.error('Invalid response from server. Please try again.');
        return;
      }

      if (user.role !== 'ADMIN') {
        toast.error('Access denied. Admin privileges required.');
        return;
      }

      setAdminAuth({ id: user.id, name: user.name, email: user.email, role: 'ADMIN', avatar: user.avatar });

      toast.success(`Welcome back, ${user.name}!`);
      router.push('/admin');
    } catch (error: unknown) {
      const msg =
        (error as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Invalid credentials. Please try again.';
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#1a1a2e] via-[#16213e] to-[#0f3460] p-4">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-primary/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-[#D4A853]/10 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-black/20">
            <Gem className="w-8 h-8 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">{brandName} Admin</h1>
          <p className="text-slate-400 text-sm mt-1">Jewellery Management Portal</p>
        </div>

        <Card className="border-0 shadow-2xl bg-white/5 backdrop-blur-xl border border-white/10">
          <CardHeader className="pb-4">
            <CardTitle className="text-white text-xl">Sign In</CardTitle>
            <CardDescription className="text-slate-400">
              Enter your admin credentials to continue
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              {/* Email */}
              <div className="space-y-2">
                <Label htmlFor="email" className="text-slate-300 text-sm font-medium">
                  Email Address
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="admin@yourbrand.com"
                    autoComplete="email"
                    className="pl-10 bg-white/10 border-white/20 text-white placeholder:text-slate-500 focus:border-primary focus:ring-primary/30 h-11"
                    {...register('email')}
                  />
                </div>
                {errors.email && (
                  <p className="text-red-400 text-xs mt-1">{errors.email.message}</p>
                )}
              </div>

              {/* Password */}
              <div className="space-y-2">
                <Label htmlFor="password" className="text-slate-300 text-sm font-medium">
                  Password
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    className="pl-10 pr-10 bg-white/10 border-white/20 text-white placeholder:text-slate-500 focus:border-primary focus:ring-primary/30 h-11"
                    {...register('password')}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {errors.password && (
                  <p className="text-red-400 text-xs mt-1">{errors.password.message}</p>
                )}
              </div>

              {/* Submit */}
              <Button
                type="submit"
                disabled={isLoading}
                className="w-full h-11 bg-gradient-to-r from-primary to-primary/70 hover:from-primary/90 hover:to-primary/60 text-white font-semibold shadow-lg shadow-black/20 transition-all duration-200 mt-2"
              >
                {isLoading ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                      />
                    </svg>
                    Signing in...
                  </span>
                ) : (
                  'Sign In to Dashboard'
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-slate-600 text-xs mt-6">
          © {new Date().getFullYear()} {brandName} Jewellery. Admin Portal.
        </p>
      </div>
    </div>
  );
}

