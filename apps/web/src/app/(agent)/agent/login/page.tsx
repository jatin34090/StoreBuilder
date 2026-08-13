'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Eye, EyeOff, Lock, Phone, Truck } from 'lucide-react';
import { Button } from '../../../../components/ui/button';
import { Input } from '../../../../components/ui/input';
import { Label } from '../../../../components/ui/label';
import { useAuthStore } from '../../../../store/authStore';
import { authApi } from '../../../../lib/api';

const schema = z.object({
  identifier: z.string().min(1, 'Phone or email is required'),
  password: z.string().min(6, 'Password required'),
});

type Form = z.infer<typeof schema>;

export default function AgentLoginPage() {
  const router = useRouter();
  const { setUser } = useAuthStore();
  const [showPwd, setShowPwd] = useState(false);

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<Form>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: Form) => {
    try {
      const res = await authApi.login(data.identifier, data.password);
      const user = res.data.data?.user ?? res.data.user;

      if (!user) {
        toast.error('Invalid response from server');
        return;
      }
      if (user.role !== 'DELIVERY_AGENT') {
        toast.error('Access denied. Delivery agent account required.');
        return;
      }

      setUser(user);
      toast.success(`Welcome, ${user.name.split(' ')[0]}!`);
      router.push('/agent');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg ?? 'Invalid credentials');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-br from-orange-500 to-orange-600 rounded-2xl flex items-center justify-center mb-4 shadow-lg">
            <Truck className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">Delivery Agent</h1>
          <p className="text-slate-400 text-sm mt-1">YourBrand Logistics Portal</p>
        </div>

        <div className="bg-white/5 backdrop-blur border border-white/10 rounded-2xl p-6 shadow-2xl">
          <h2 className="text-white font-semibold text-lg mb-5">Sign In</h2>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <Label className="text-slate-300 text-sm">Phone or Email</Label>
              <div className="relative mt-1.5">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <Input
                  placeholder="9876543210 or email"
                  className="pl-9 bg-white/10 border-white/20 text-white placeholder:text-slate-500 h-11"
                  {...register('identifier')}
                />
              </div>
              {errors.identifier && <p className="text-red-400 text-xs mt-1">{errors.identifier.message}</p>}
            </div>

            <div>
              <Label className="text-slate-300 text-sm">Password</Label>
              <div className="relative mt-1.5">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <Input
                  type={showPwd ? 'text' : 'password'}
                  placeholder="••••••••"
                  className="pl-9 pr-10 bg-white/10 border-white/20 text-white placeholder:text-slate-500 h-11"
                  {...register('password')}
                />
                <button
                  type="button"
                  onClick={() => setShowPwd(!showPwd)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                  tabIndex={-1}
                >
                  {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.password && <p className="text-red-400 text-xs mt-1">{errors.password.message}</p>}
            </div>

            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full h-11 bg-orange-500 hover:bg-orange-600 text-white font-semibold mt-2"
            >
              {isSubmitting ? 'Signing in...' : 'Sign In'}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
