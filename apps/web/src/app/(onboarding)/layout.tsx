import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Set up your store',
  description: 'Complete your store setup to start selling.',
  robots: { index: false, follow: false },
};

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
      {children}
    </div>
  );
}
