import type { Metadata } from 'next';
import Link from 'next/link';
import { Check, ArrowLeft, Zap, TrendingUp, Store, Building2, Phone } from 'lucide-react';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = {
  title: 'Pricing — StoreBuilder',
  description: 'All plans include the complete ecommerce platform. Upgrade as your business grows.',
};

interface PlanData {
  plan: string;
  name: string;
  description: string;
  priceMonthly: number;
  priceYearly: number;
  trialDays: number;
  features: string[];
  limits: {
    maxProducts: number | null;
    maxStaff: number | null;
    maxStorageGB: number;
    maxOrders: number | null;
    maxDomains: number | null;
    maxApiPerMonth: number | null;
  };
}

async function fetchPlans(): Promise<PlanData[] | null> {
  const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001/api/v1';
  try {
    const res = await fetch(`${API_URL}/billing/plans`, { next: { revalidate: 3600 } });
    if (!res.ok) return null;
    const json = (await res.json()) as Record<string, unknown>;
    return (json['data'] ?? json) as PlanData[];
  } catch {
    return null;
  }
}

const FALLBACK: PlanData[] = [
  {
    plan: 'FREE', name: 'Free', description: 'Launch your store',
    priceMonthly: 0, priceYearly: 0, trialDays: 0,
    features: [],
    limits: { maxProducts: 25, maxStaff: 1, maxStorageGB: 1, maxOrders: 50, maxDomains: 1, maxApiPerMonth: 1000 },
  },
  {
    plan: 'STARTER', name: 'Starter', description: 'Grow your business',
    priceMonthly: 49900, priceYearly: 499000, trialDays: 14,
    features: [],
    limits: { maxProducts: 500, maxStaff: 3, maxStorageGB: 5, maxOrders: 1000, maxDomains: 2, maxApiPerMonth: 25000 },
  },
  {
    plan: 'GROWTH', name: 'Growth', description: 'Scale your sales',
    priceMonthly: 149900, priceYearly: 1499000, trialDays: 21,
    features: [],
    limits: { maxProducts: 5000, maxStaff: 10, maxStorageGB: 25, maxOrders: 10000, maxDomains: 5, maxApiPerMonth: 250000 },
  },
  {
    plan: 'BUSINESS', name: 'Business', description: 'Run high-volume commerce',
    priceMonthly: 399900, priceYearly: 3999000, trialDays: 30,
    features: [],
    limits: { maxProducts: null, maxStaff: 30, maxStorageGB: 100, maxOrders: 50000, maxDomains: 10, maxApiPerMonth: 1000000 },
  },
  {
    plan: 'ENTERPRISE', name: 'Enterprise', description: 'Built around your business',
    priceMonthly: 0, priceYearly: 0, trialDays: 30,
    features: [],
    limits: { maxProducts: null, maxStaff: null, maxStorageGB: 1000, maxOrders: null, maxDomains: null, maxApiPerMonth: null },
  },
];

const PLAN_ORDER = ['FREE', 'STARTER', 'GROWTH', 'BUSINESS', 'ENTERPRISE'];

function fmt(n: number | null | undefined) {
  if (n == null) return 'Unlimited';
  return n.toLocaleString('en-IN');
}
function paise(p: number) { return `₹${(p / 100).toLocaleString('en-IN')}`; }
function unlim(v: number | null | undefined, suffix = '') {
  return v == null ? 'Unlimited' : `${fmt(v)}${suffix}`;
}

const PLAN_ICONS: Record<string, React.ReactNode> = {
  FREE:       <Store className="h-5 w-5" />,
  STARTER:    <Zap className="h-5 w-5" />,
  GROWTH:     <TrendingUp className="h-5 w-5" />,
  BUSINESS:   <Building2 className="h-5 w-5" />,
  ENTERPRISE: <Phone className="h-5 w-5" />,
};

const CORE_INCLUSIONS = [
  'Online storefront & product pages',
  'Cart, checkout & order management',
  'Payment integrations (Razorpay, UPI, COD)',
  'Shiprocket & Delhivery shipping',
  'Discount coupons & promotions',
  'Analytics dashboard',
  'Staff management',
  'Custom themes & pages',
  'Custom domain support',
  'API access',
  'Email notifications',
];

export default async function PricingPage() {
  const apiPlans = await fetchPlans();
  const allPlans = (apiPlans ?? FALLBACK).sort(
    (a, b) => PLAN_ORDER.indexOf(a.plan) - PLAN_ORDER.indexOf(b.plan),
  );
  // Exclude legacy PROFESSIONAL plan from display
  const plans = allPlans.filter((p) => p.plan !== 'PROFESSIONAL');

  return (
    <div className="min-h-screen bg-background">

      {/* Nav */}
      <nav className="border-b border-border/50 bg-background/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-4 w-4" />
            <span className="text-sm">Back to home</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/auth/login" className="text-sm text-muted-foreground hover:text-foreground">Sign in</Link>
            <Button asChild size="sm" className="bg-violet-600 hover:bg-violet-700 text-white">
              <Link href="/register">Start Free Trial</Link>
            </Button>
          </div>
        </div>
      </nav>

      <div className="mx-auto max-w-7xl px-6 py-16 space-y-20">

        {/* Hero */}
        <div className="text-center space-y-4">
          <div className="inline-flex items-center gap-2 rounded-full bg-violet-100 px-4 py-1.5 text-sm font-medium text-violet-700 dark:bg-violet-950/40 dark:text-violet-400">
            <Check className="h-3.5 w-3.5" /> All plans include the complete ecommerce platform
          </div>
          <h1 className="text-4xl font-bold text-foreground md:text-5xl">
            Upgrade as your business grows
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Every plan comes with payments, shipping, coupons, analytics, and everything
            you need to sell online. Plans differ only by limits and scale.
          </p>
        </div>

        {/* Plan cards */}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {plans.map((plan) => {
            const popular   = plan.plan === 'GROWTH';
            const enterprise = plan.plan === 'ENTERPRISE';

            return (
              <div
                key={plan.plan}
                className={`relative flex flex-col rounded-2xl border-2 p-5 ${
                  popular
                    ? 'border-violet-500 bg-violet-50 shadow-xl shadow-violet-100 dark:bg-violet-950/20 dark:shadow-violet-950/40'
                    : 'border-border bg-card'
                }`}
              >
                {popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="rounded-full bg-violet-600 px-3 py-1 text-xs font-bold text-white shadow-sm whitespace-nowrap">
                      Most Popular
                    </span>
                  </div>
                )}

                {/* Icon + name */}
                <div className={`mb-3 flex items-center gap-2 ${popular ? 'text-violet-600' : 'text-muted-foreground'}`}>
                  {PLAN_ICONS[plan.plan]}
                  <span className="text-xs font-semibold uppercase tracking-wider">{plan.plan}</span>
                </div>

                <h2 className="text-xl font-bold text-foreground mb-0.5">{plan.name}</h2>
                <p className="text-xs text-muted-foreground mb-4">{plan.description}</p>

                {/* Price */}
                <div className="mb-5">
                  {enterprise ? (
                    <div className="text-2xl font-black text-foreground">Custom</div>
                  ) : (
                    <>
                      <div className="text-3xl font-black text-foreground">
                        {plan.priceMonthly === 0 ? 'Free' : paise(plan.priceMonthly)}
                      </div>
                      {plan.priceMonthly > 0 && (
                        <div className="text-xs text-muted-foreground">/ month + GST</div>
                      )}
                    </>
                  )}
                  {plan.trialDays > 0 && !enterprise && (
                    <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">
                      <Check className="h-3 w-3" />{plan.trialDays}-day free trial
                    </div>
                  )}
                </div>

                {/* Limits */}
                <div className="mb-5 rounded-xl bg-muted/50 p-3 text-xs space-y-1.5 flex-1">
                  <LimitRow label="Products"       value={unlim(plan.limits.maxProducts)} />
                  <LimitRow label="Orders/month"   value={unlim(plan.limits.maxOrders)} />
                  <LimitRow label="Staff"          value={unlim(plan.limits.maxStaff)} />
                  <LimitRow label="Storage"        value={`${plan.limits.maxStorageGB} GB`} />
                  <LimitRow label="Custom domains" value={unlim(plan.limits.maxDomains)} />
                  <LimitRow label="API/month"      value={unlim(plan.limits.maxApiPerMonth)} />
                </div>

                {enterprise ? (
                  <Button asChild variant="outline" className="w-full">
                    <Link href="/contact-sales">Contact Sales</Link>
                  </Button>
                ) : (
                  <Button
                    asChild
                    variant={popular ? 'default' : 'outline'}
                    className={`w-full ${popular ? 'bg-violet-600 hover:bg-violet-700 text-white' : ''}`}
                  >
                    <Link href="/register">
                      {plan.priceMonthly === 0 ? 'Get started free' : `Start ${plan.trialDays}-day trial`}
                    </Link>
                  </Button>
                )}
              </div>
            );
          })}
        </div>

        {/* What's included in every plan */}
        <div className="rounded-2xl border border-border bg-card p-8">
          <h2 className="text-2xl font-bold text-foreground text-center mb-2">
            Every plan includes the complete ecommerce platform
          </h2>
          <p className="text-muted-foreground text-center mb-8 text-sm">
            No essential feature is locked behind a higher tier. Plans differ only by limits.
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {CORE_INCLUSIONS.map((item) => (
              <div key={item} className="flex items-center gap-2.5 text-sm text-foreground">
                <span className="flex-shrink-0 h-5 w-5 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center dark:bg-emerald-950/40 dark:text-emerald-400">
                  <Check className="h-3 w-3" />
                </span>
                {item}
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground text-center mt-6">
            Growth+ plans also include: Advanced reports &amp; bulk product import/export
          </p>
        </div>

        {/* Limits comparison table */}
        <div>
          <h2 className="text-2xl font-bold text-foreground text-center mb-8">Plan limits at a glance</h2>
          <div className="overflow-x-auto rounded-2xl border border-border">
            <table className="w-full text-sm min-w-[640px]">
              <thead className="border-b border-border bg-muted/40">
                <tr>
                  <th className="px-6 py-4 text-left font-semibold text-foreground">Limit</th>
                  {plans.map((p) => (
                    <th key={p.plan} className={`px-4 py-4 text-center font-semibold ${p.plan === 'GROWTH' ? 'text-violet-600' : 'text-foreground'}`}>
                      {p.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {[
                  { label: 'Products',        key: 'maxProducts'    as const },
                  { label: 'Orders / month',  key: 'maxOrders'      as const },
                  { label: 'Staff members',   key: 'maxStaff'       as const },
                  { label: 'Custom domains',  key: 'maxDomains'     as const },
                  { label: 'API req / month', key: 'maxApiPerMonth' as const },
                ].map(({ label, key }) => (
                  <tr key={key} className="hover:bg-muted/20 transition-colors">
                    <td className="px-6 py-3 font-medium text-foreground">{label}</td>
                    {plans.map((p) => {
                      const v = (p.limits as Record<string, number | null>)[key];
                      return (
                        <td key={p.plan} className={`px-4 py-3 text-center ${p.plan === 'GROWTH' ? 'font-semibold text-violet-600' : 'text-muted-foreground'}`}>
                          {v == null ? 'Unlimited' : fmt(v)}
                        </td>
                      );
                    })}
                  </tr>
                ))}
                <tr className="hover:bg-muted/20 transition-colors">
                  <td className="px-6 py-3 font-medium text-foreground">Storage</td>
                  {plans.map((p) => (
                    <td key={p.plan} className={`px-4 py-3 text-center ${p.plan === 'GROWTH' ? 'font-semibold text-violet-600' : 'text-muted-foreground'}`}>
                      {p.limits.maxStorageGB} GB
                    </td>
                  ))}
                </tr>
                <tr className="hover:bg-muted/20 transition-colors">
                  <td className="px-6 py-3 font-medium text-foreground">Advanced reports &amp; bulk import</td>
                  {plans.map((p) => (
                    <td key={p.plan} className="px-4 py-3 text-center">
                      {['GROWTH', 'BUSINESS', 'ENTERPRISE'].includes(p.plan)
                        ? <Check className="mx-auto h-4 w-4 text-emerald-500" />
                        : <span className="text-muted-foreground/40 text-xs">—</span>
                      }
                    </td>
                  ))}
                </tr>
                <tr className="hover:bg-muted/20 transition-colors">
                  <td className="px-6 py-3 font-medium text-foreground">Free trial</td>
                  {plans.map((p) => (
                    <td key={p.plan} className="px-4 py-3 text-center text-muted-foreground text-xs">
                      {p.plan === 'ENTERPRISE' ? 'Custom' : p.trialDays > 0 ? `${p.trialDays} days` : '—'}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* CTA */}
        <div className="rounded-2xl bg-violet-600 px-8 py-12 text-center text-white">
          <h2 className="mb-2 text-2xl font-bold">Start for free — upgrade when you're ready</h2>
          <p className="mb-6 text-violet-100 text-sm">
            No credit card required on the Free plan. Paid plans come with a free trial.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Button asChild size="lg" variant="secondary" className="bg-white text-violet-700 hover:bg-violet-50 px-8">
              <Link href="/register">Get started free</Link>
            </Button>
            <Button asChild size="lg" variant="ghost" className="text-white border border-white/30 hover:bg-white/10 px-8">
              <Link href="/contact-sales">Talk to sales</Link>
            </Button>
          </div>
        </div>

      </div>
    </div>
  );
}

function LimitRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-semibold ${value === 'Unlimited' ? 'text-violet-600 dark:text-violet-400' : 'text-foreground'}`}>
        {value}
      </span>
    </div>
  );
}
