'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { api } from '@/lib/api';
import { toast } from 'sonner';

export default function AuthCallbackPage() {
  const router = useRouter();
  const { setUser } = useAuthStore();

  useEffect(() => {
    api
      .get('/users/me')
      .then((res) => {
        const user = res.data?.data ?? res.data;
        if (!user) throw new Error('No user data');

        setUser({ id: user.id, name: user.name, email: user.email, phone: user.phone, role: user.role, storeId: user.storeId ?? undefined });
        toast.success(`Welcome, ${user.name.split(' ')[0]}!`);

        // Role-based redirect
        if (user.role === 'ADMIN') {
          router.replace('/admin');
        } else if (user.role === 'SUPER_ADMIN') {
          router.replace('/super-admin');
        } else if (user.role === 'DELIVERY_AGENT') {
          router.replace('/agent');
        } else {
          // Read the store page the customer was on before Google OAuth started.
          // Falls back to '/' if nothing was saved (e.g. private browsing).
          let returnTo = '/';
          try {
            const saved = sessionStorage.getItem('oauth_return_to');
            if (saved && saved.startsWith('/')) { returnTo = saved; sessionStorage.removeItem('oauth_return_to'); }
          } catch { /* private mode — use default */ }
          router.replace(returnTo);
        }
      })
      .catch(() => {
        toast.error('Google sign-in failed. Please try again.');
        router.replace('/auth/login');
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center space-y-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
        <p className="text-sm text-muted-foreground">Signing you in…</p>
      </div>
    </div>
  );
}
