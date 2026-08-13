'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { useAdminAuthStore } from '@/store/adminAuthStore';
import { api } from '@/lib/api';
import { toast } from 'sonner';

export default function AuthCallbackPage() {
  const router = useRouter();
  const { setUser } = useAuthStore();
  const { setAdminAuth } = useAdminAuthStore();

  useEffect(() => {
    api
      .get('/users/me')
      .then((res) => {
        const user = res.data?.data ?? res.data;
        if (!user) throw new Error('No user data');

        if (user.role === 'ADMIN') {
          setAdminAuth({ id: user.id, name: user.name, email: user.email, role: 'ADMIN', avatar: user.avatar });
          toast.success(`Welcome back, ${user.name.split(' ')[0]}!`);
          router.replace('/admin');
        } else {
          setUser({ id: user.id, name: user.name, email: user.email, phone: user.phone, role: user.role });
          toast.success(`Welcome, ${user.name.split(' ')[0]}!`);
          router.replace('/');
        }
      })
      .catch(() => {
        toast.error('Google sign-in failed. Please try again.');
        router.replace('/auth/login');
      });
  }, [router, setUser, setAdminAuth]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center space-y-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
        <p className="text-sm text-muted-foreground">Signing you in…</p>
      </div>
    </div>
  );
}
