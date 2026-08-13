'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminSettingsPage() {
  const router = useRouter();
  useEffect(() => { router.replace('/admin/customize'); }, [router]);
  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <p className="text-sm text-gray-400">Redirecting to Customise…</p>
    </div>
  );
}
