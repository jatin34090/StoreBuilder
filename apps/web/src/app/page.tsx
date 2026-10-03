import type { Metadata } from 'next';
import Link from 'next/link';
import {
  Store, ShoppingBag, Globe, CreditCard, Truck, BarChart3,
  Check, Star, Zap, Shield, Headphones, Palette,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { LandingNavAuth } from '@/components/landing/LandingNavAuth';
import { LandingHeroCTA } from '@/components/landing/LandingHeroCTA';

export const metadata: Metadata = {
  title: 'StoreBuilder — Launch Your Online Store in Minutes',
  description: 'The all-in-one ecommerce platform for Indian businesses. Custom domain, payments, shipping, analytics — 21-day free trial.',
};

// Fetched at request time — always fresh (no storeId → platform-level endpoint)
async function fetchPlans() {
  const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001/api/v1';
  try {
    const res = await fetch(`${API_URL}/billing/plans`, { next: { revalidate: 3600 } });
    if (!res.ok) return null;
    const json = (await res.json()) as Record<string, unknown>;
    return (json['data'] ?? json) as Array<{
      plan: string; name: string; description: string;
      priceMonthly: number; trialDays: number; features: string[];
      limits: { maxProducts: number; maxStaff: number; maxStorageGB: number; maxOrders: number | null };
    }>;
  } catch {
    return null;
  }
}

// ─── Static plan data (fallback when API is unavailable) ─────────────────────

const FALLBACK_PLANS = [
  {
    plan: 'FREE',       name: 'Free',         priceMonthly: 0,      trialDays: 0,
    description: 'Get started at no cost',
    features: ['50 products', '2 staff', '1 GB storage', 'Basic analytics'],
    highlight: false,
  },
  {
    plan: 'STARTER',    name: 'Starter',      priceMonthly: 99900,  trialDays: 21,
    description: 'For growing businesses',
    features: ['500 products', '5 staff', '10 GB storage', 'Advanced theme', 'Coupons'],
    highlight: false,
  },
  {
    plan: 'PROFESSIONAL', name: 'Professional', priceMonthly: 299900, trialDays: 21,
    description: 'Power and automation',
    features: ['5000 products', '20 staff', '100 GB storage', 'Bulk import', 'Shipping integrations', 'Custom domain'],
    highlight: true,
  },
  {
    plan: 'ENTERPRISE', name: 'Enterprise',   priceMonthly: 999900, trialDays: 30,
    description: 'For large operations',
    features: ['Unlimited products', 'Unlimited staff', '500 GB storage', 'API access', 'Dedicated support'],
    highlight: false,
  },
];

function paise(p: number) {
  if (p === 0) return 'Free';
  return `₹${(p / 100).toLocaleString('en-IN')}`;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function LandingPage() {
  const apiPlans = await fetchPlans();

  const plans = apiPlans
    ? apiPlans.map((p) => ({
        ...p,
        features: p.features.map((f) => f.replace(/_/g, ' ')),
        highlight: p.plan === 'PROFESSIONAL',
      }))
    : FALLBACK_PLANS;

  return (
    <div className="min-h-screen bg-background text-foreground">

      {/* ─── Navbar ─────────────────────────────────────────────────────── */}
      <nav className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-600">
              <Store className="h-4 w-4 text-white" />
            </div>
            <span className="text-lg font-bold">StoreBuilder</span>
          </div>
          <div className="hidden gap-8 md:flex">
            <a href="#features" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Features</a>
            <a href="#pricing"  className="text-sm text-muted-foreground hover:text-foreground transition-colors">Pricing</a>
          </div>
          <div className="flex items-center gap-3">
            <LandingNavAuth />
          </div>
        </div>
      </nav>

      {/* ─── Hero ───────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: 'radial-gradient(ellipse 80% 60% at 50% -10%, hsl(263 70% 50% / 0.08) 0%, transparent 70%)' }}
        />
        <div className="mx-auto max-w-5xl px-6 py-28 text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-violet-200 bg-violet-50 px-4 py-1.5 text-sm text-violet-700 dark:border-violet-800 dark:bg-violet-950/40 dark:text-violet-300">
            <Zap className="h-3.5 w-3.5" />
            21-day free trial — no credit card required
          </div>

          <h1 className="mb-6 font-bold text-foreground" style={{ fontSize: 'clamp(2.4rem, 6vw, 4.5rem)', lineHeight: 1.1 }}>
            Launch your online store{' '}
            <span className="bg-gradient-to-r from-violet-600 to-indigo-500 bg-clip-text text-transparent">
              in minutes
            </span>
          </h1>

          <p className="mx-auto mb-10 max-w-xl text-lg text-muted-foreground">
            The all-in-one ecommerce SaaS platform built for Indian businesses.
            Payments, shipping, analytics, custom domain — everything included.
          </p>

          <LandingHeroCTA />
        </div>
      </section>

      {/* ─── Stats ──────────────────────────────────────────────────────── */}
      <section className="border-y border-border/50 bg-muted/30">
        <div className="mx-auto grid max-w-5xl grid-cols-2 divide-x divide-border/50 md:grid-cols-4">
          {[
            { value: '10,000+', label: 'Stores launched' },
            { value: '₹50 Cr+', label: 'GMV processed' },
            { value: '99.9%',   label: 'Uptime SLA' },
            { value: '21 days', label: 'Free trial' },
          ].map(({ value, label }) => (
            <div key={label} className="py-8 text-center">
              <div className="text-2xl font-bold text-foreground md:text-3xl">{value}</div>
              <div className="mt-1 text-xs text-muted-foreground uppercase tracking-wider">{label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ─── Features ───────────────────────────────────────────────────── */}
      <section id="features" className="py-24">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mb-16 text-center">
            <h2 className="mb-4 text-3xl font-bold text-foreground md:text-4xl">
              Everything you need to sell online
            </h2>
            <p className="text-muted-foreground">All the tools that your business needs, built into one platform.</p>
          </div>

          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            {[
              {
                icon: <ShoppingBag className="h-6 w-6" />,
                title: 'Ecommerce Storefront',
                desc: 'Beautiful, mobile-first storefront with product catalog, categories, search, and wishlist built in.',
              },
              {
                icon: <Palette className="h-6 w-6" />,
                title: 'Store Customisation',
                desc: 'Choose from premium themes. Customise colors, hero content, featured products, and footer — no code.',
              },
              {
                icon: <Globe className="h-6 w-6" />,
                title: 'Custom Domain',
                desc: 'Connect your own domain (e.g., www.mybrand.in). Free SSL, DNS instructions provided instantly.',
              },
              {
                icon: <CreditCard className="h-6 w-6" />,
                title: 'Razorpay Payments',
                desc: 'Accept UPI, cards, net banking, wallets, and COD. One-click integration, fully PCI-compliant.',
              },
              {
                icon: <Truck className="h-6 w-6" />,
                title: 'Shipping & Delivery',
                desc: 'Integrated Shiprocket shipping. Set per-store flat rates, free-shipping thresholds, and delivery zones.',
              },
              {
                icon: <BarChart3 className="h-6 w-6" />,
                title: 'Analytics',
                desc: 'Real-time order analytics, revenue trends, product performance, and customer insights.',
              },
              {
                icon: <Shield className="h-6 w-6" />,
                title: 'Tenant Isolation',
                desc: 'Every store is a fully isolated tenant. Your data, your customers — completely private.',
              },
              {
                icon: <Star className="h-6 w-6" />,
                title: 'Reviews & Coupons',
                desc: 'Customer reviews, verified purchase badges, discount coupons with usage limits and expiry.',
              },
              {
                icon: <Headphones className="h-6 w-6" />,
                title: 'Staff Management',
                desc: 'Invite team members with granular role-based permissions. Separate admin and delivery agent roles.',
              },
            ].map(({ icon, title, desc }) => (
              <div key={title} className="rounded-2xl border border-border/60 bg-card p-6 hover:border-violet-300 transition-colors dark:hover:border-violet-700">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-violet-100 text-violet-600 dark:bg-violet-950/50 dark:text-violet-400">
                  {icon}
                </div>
                <h3 className="mb-2 text-base font-semibold text-foreground">{title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── How It Works ───────────────────────────────────────────────── */}
      <section className="bg-muted/30 py-24">
        <div className="mx-auto max-w-5xl px-6">
          <div className="mb-16 text-center">
            <h2 className="mb-4 text-3xl font-bold text-foreground md:text-4xl">How it works</h2>
            <p className="text-muted-foreground">From signup to selling in under 10 minutes.</p>
          </div>

          <div className="grid gap-6 md:grid-cols-4">
            {[
              { step: '01', title: 'Sign up',          desc: 'Create your account — takes 30 seconds.' },
              { step: '02', title: 'Choose a plan',    desc: 'Start with 21-day free trial on any paid plan.' },
              { step: '03', title: 'Create your store', desc: 'Name it, pick your industry, set your store URL.' },
              { step: '04', title: 'Start selling',    desc: 'Add products, configure shipping, share your link.' },
            ].map(({ step, title, desc }) => (
              <div key={step} className="relative rounded-2xl border border-border/60 bg-background p-6">
                <div className="mb-4 text-4xl font-black text-violet-100 dark:text-violet-950">{step}</div>
                <h3 className="mb-2 font-semibold text-foreground">{title}</h3>
                <p className="text-sm text-muted-foreground">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Pricing ────────────────────────────────────────────────────── */}
      <section id="pricing" className="py-24">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mb-16 text-center">
            <h2 className="mb-4 text-3xl font-bold text-foreground md:text-4xl">Simple, transparent pricing</h2>
            <p className="text-muted-foreground">
              All paid plans include a {plans.find(p => p.plan === 'STARTER')?.trialDays ?? 21}-day free trial. No credit card required.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
            {plans.map((plan) => (
              <div
                key={plan.plan}
                className={`relative flex flex-col rounded-2xl border-2 p-6 transition-all ${
                  plan.highlight
                    ? 'border-violet-500 bg-violet-50 shadow-lg shadow-violet-100 dark:bg-violet-950/20 dark:shadow-violet-950/30'
                    : 'border-border bg-card'
                }`}
              >
                {plan.highlight && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="rounded-full bg-violet-600 px-4 py-1 text-xs font-semibold text-white">
                      Most Popular
                    </span>
                  </div>
                )}

                <h3 className="mb-1 text-xl font-bold text-foreground">{plan.name}</h3>
                <p className="mb-5 text-xs text-muted-foreground">{plan.description}</p>

                <div className="mb-5">
                  <span className="text-3xl font-bold text-foreground">
                    {'priceMonthly' in plan ? paise(plan.priceMonthly as number) : 'Free'}
                  </span>
                  {('priceMonthly' in plan ? (plan.priceMonthly as number) : 0) > 0 && (
                    <span className="ml-1 text-sm text-muted-foreground">/month</span>
                  )}
                  {(plan.trialDays ?? 0) > 0 && (
                    <p className="mt-1 text-xs font-medium text-emerald-600">
                      {plan.trialDays}-day free trial
                    </p>
                  )}
                </div>

                <ul className="mb-8 flex-1 space-y-2">
                  {(plan.features ?? []).map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm">
                      <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-500" />
                      <span className="text-muted-foreground capitalize">{f}</span>
                    </li>
                  ))}
                </ul>

                <Button
                  asChild
                  variant={plan.highlight ? 'default' : 'outline'}
                  className={`w-full ${plan.highlight ? 'bg-violet-600 hover:bg-violet-700 text-white' : ''}`}
                >
                  <Link href="/register">
                    {(plan.trialDays ?? 0) > 0 ? `Start ${plan.trialDays}-day trial` : 'Get started free'}
                  </Link>
                </Button>
              </div>
            ))}
          </div>

          <p className="mt-8 text-center text-sm text-muted-foreground">
            Need a custom plan?{' '}
            <a href="mailto:support@storebuilder.in" className="font-medium text-violet-600 hover:underline dark:text-violet-400">
              Contact us
            </a>
          </p>
        </div>
      </section>

      {/* ─── Trial Explainer ────────────────────────────────────────────── */}
      <section className="bg-muted/30 py-24">
        <div className="mx-auto max-w-3xl px-6 text-center">
          <div className="mb-4 text-5xl font-black text-violet-600">21</div>
          <h2 className="mb-4 text-3xl font-bold text-foreground">Days free. Seriously free.</h2>
          <p className="mb-8 text-muted-foreground">
            Start with our full-featured trial — no credit card, no commitment.
            You get 21 days to explore every feature on Starter or Professional.
            When the trial ends, choose a plan or downgrade to Free.
          </p>

          <div className="grid gap-4 text-left sm:grid-cols-3">
            {[
              { label: 'Day 1',    desc: 'Sign up and create your store in minutes.' },
              { label: 'Day 1–21', desc: 'Use every feature — no restrictions during trial.' },
              { label: 'Day 21',   desc: 'Add a payment method to continue, or switch to Free.' },
            ].map(({ label, desc }) => (
              <div key={label} className="rounded-xl border border-border/60 bg-background p-4">
                <p className="mb-1 font-semibold text-violet-600">{label}</p>
                <p className="text-sm text-muted-foreground">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Final CTA ──────────────────────────────────────────────────── */}
      <section className="py-24">
        <div className="mx-auto max-w-3xl px-6 text-center">
          <h2 className="mb-4 text-3xl font-bold text-foreground md:text-4xl">
            Ready to build your store?
          </h2>
          <p className="mb-8 text-muted-foreground">
            Join thousands of Indian businesses selling online with StoreBuilder.
          </p>
          <LandingHeroCTA />
        </div>
      </section>

      {/* ─── Footer ─────────────────────────────────────────────────────── */}
      <footer className="border-t border-border/50 bg-muted/30 py-12">
        <div className="mx-auto max-w-7xl px-6">
          <div className="flex flex-col items-center justify-between gap-6 md:flex-row">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-600">
                <Store className="h-4 w-4 text-white" />
              </div>
              <span className="font-bold text-foreground">StoreBuilder</span>
            </div>

            <div className="flex flex-wrap justify-center gap-6 text-sm text-muted-foreground">
              <a href="#features" className="hover:text-foreground transition-colors">Features</a>
              <a href="#pricing"  className="hover:text-foreground transition-colors">Pricing</a>
              <Link href="/register" className="hover:text-foreground transition-colors">Sign up</Link>
              <Link href="/auth/login" className="hover:text-foreground transition-colors">Login</Link>
            </div>

            <p className="text-xs text-muted-foreground">
              &copy; {new Date().getFullYear()} StoreBuilder. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
