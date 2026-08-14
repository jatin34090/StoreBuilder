'use client';

import { useEffect, useState } from 'react';
import {
  CreditCard, Zap, TrendingUp, AlertTriangle, CheckCircle, Clock,
  ChevronRight, ReceiptText, RefreshCw, Lock,
} from 'lucide-react';
import { adminBillingApi, type BillingStatus, type BillingInvoice, type PlanOption } from '../../../../../lib/admin-api';

// ─── helpers ────────────────────────────────────────────────────────────────

function paise(p: number) {
  return `₹${(p / 100).toLocaleString('en-IN')}`;
}

function pct(used: number, max: number | null): number {
  if (!max || max < 0) return 0;
  return Math.min(100, Math.round((used / max) * 100));
}

function statusColor(status: string) {
  const map: Record<string, string> = {
    ACTIVE:    'text-green-600 bg-green-50 border-green-200',
    TRIALING:  'text-blue-600 bg-blue-50 border-blue-200',
    PAST_DUE:  'text-amber-600 bg-amber-50 border-amber-200',
    PAUSED:    'text-slate-600 bg-slate-50 border-slate-200',
    CANCELLED: 'text-red-600 bg-red-50 border-red-200',
    EXPIRED:   'text-red-600 bg-red-50 border-red-200',
  };
  return map[status] ?? 'text-slate-600 bg-slate-50 border-slate-200';
}

function MeterBar({ used, max, label, unit = '' }: {
  used: number; max: number | null; label: string; unit?: string;
}) {
  const percent = pct(used, max);
  const isUnlimited = max === null || max < 0;
  const warn = percent >= 80;
  const full = percent >= 100;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="text-slate-700 font-medium">{label}</span>
        <span className={`text-xs font-semibold ${full ? 'text-red-600' : warn ? 'text-amber-600' : 'text-slate-500'}`}>
          {isUnlimited ? `${used}${unit} / Unlimited` : `${used}${unit} / ${max}${unit}`}
          {!isUnlimited && ` (${percent}%)`}
        </span>
      </div>
      {!isUnlimited && (
        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${full ? 'bg-red-500' : warn ? 'bg-amber-400' : 'bg-primary'}`}
            style={{ width: `${percent}%` }}
          />
        </div>
      )}
      {warn && !full && (
        <p className="text-xs text-amber-600 flex items-center gap-1">
          <AlertTriangle className="w-3 h-3" /> Approaching limit — consider upgrading
        </p>
      )}
      {full && (
        <p className="text-xs text-red-600 flex items-center gap-1">
          <AlertTriangle className="w-3 h-3" /> Limit reached — new items will be blocked
        </p>
      )}
    </div>
  );
}

const PLAN_ORDER = ['FREE', 'STARTER', 'PROFESSIONAL', 'ENTERPRISE'];

const FEATURE_LABELS: Record<string, string> = {
  analytics:             'Analytics',
  coupons:               'Discount Coupons',
  staff_management:      'Staff Management',
  advanced_theme:        'Advanced Theme',
  custom_pages:          'Custom Pages',
  advanced_reports:      'Advanced Reports',
  bulk_import:           'Bulk Import',
  shipping_integrations: 'Shipping Integrations',
  payment_integrations:  'Payment Integrations',
  custom_domain:         'Custom Domain',
  api_access:            'API Access',
};

export default function SubscriptionPage() {
  const [status, setStatus]     = useState<BillingStatus | null>(null);
  const [invoices, setInvoices] = useState<BillingInvoice[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [view, setView]         = useState<'overview' | 'plans' | 'history'>('overview');

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError('');
      try {
        const [s, inv] = await Promise.all([
          adminBillingApi.getStatus(),
          adminBillingApi.getInvoices(),
        ]);
        setStatus(s);
        setInvoices(inv);
      } catch {
        setError('Failed to load billing information.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-6 py-4">{error}</div>
    );
  }

  const sub  = status?.subscription;
  const usage = status?.usage;
  const allPlans = status?.plans ?? [];
  const currentPlanSlug = status?.plan ?? 'FREE';

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <CreditCard className="w-6 h-6 text-primary" />
          Subscription & Billing
        </h1>
        <p className="text-slate-500 text-sm mt-1">Manage your plan, usage, and billing history.</p>
      </div>

      {/* Tab nav */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-lg w-fit">
        {(['overview', 'plans', 'history'] as const).map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition ${
              view === v ? 'bg-white shadow text-slate-900' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {v === 'overview' ? 'Overview' : v === 'plans' ? 'Plans' : 'History'}
          </button>
        ))}
      </div>

      {/* ── Overview ──────────────────────────────────────────────────────── */}
      {view === 'overview' && (
        <div className="space-y-6">
          {/* Current plan card */}
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Current Plan</p>
                <h2 className="text-3xl font-bold text-slate-900">
                  {allPlans.find(p => p.plan === currentPlanSlug)?.name ?? currentPlanSlug}
                </h2>
                {allPlans.find(p => p.plan === currentPlanSlug)?.priceMonthly ? (
                  <p className="text-slate-500 text-sm mt-1">
                    {paise(allPlans.find(p => p.plan === currentPlanSlug)!.priceMonthly)}/month
                  </p>
                ) : (
                  <p className="text-slate-500 text-sm mt-1">Free forever</p>
                )}
              </div>
              <div className="flex items-center gap-3">
                {sub && (
                  <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border ${statusColor(sub.status)}`}>
                    {sub.status === 'TRIALING' && <Clock className="w-3 h-3 mr-1" />}
                    {sub.status === 'ACTIVE' && <CheckCircle className="w-3 h-3 mr-1" />}
                    {sub.status}
                  </span>
                )}
                <button
                  onClick={() => setView('plans')}
                  className="flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition"
                >
                  <Zap className="w-4 h-4" />
                  Upgrade
                </button>
              </div>
            </div>

            {/* Trial banner */}
            {sub?.status === 'TRIALING' && sub.trialEnd && (
              <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 flex items-center gap-2 text-blue-700 text-sm">
                <Clock className="w-4 h-4 flex-shrink-0" />
                Trial ends on <strong>{new Date(sub.trialEnd).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</strong>. Add a payment method before it expires.
              </div>
            )}

            {/* Cancel warning */}
            {sub?.cancelAtPeriodEnd && sub.currentPeriodEnd && (
              <div className="mt-4 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 flex items-center gap-2 text-amber-700 text-sm">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                Your subscription will cancel on <strong>{new Date(sub.currentPeriodEnd).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</strong>.
              </div>
            )}

            {/* Renewal info */}
            {sub?.status === 'ACTIVE' && !sub.cancelAtPeriodEnd && sub.currentPeriodEnd && (
              <p className="mt-4 text-sm text-slate-500">
                Renews on <strong>{new Date(sub.currentPeriodEnd).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</strong>
              </p>
            )}
          </div>

          {/* Usage */}
          {usage && (
            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <h3 className="text-base font-semibold text-slate-900 mb-5 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-primary" />
                Usage
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <MeterBar label="Products"         used={usage.products.used}    max={usage.products.max} />
                <MeterBar label="Staff Members"    used={usage.staff.used}       max={usage.staff.max} />
                <MeterBar label="Storage"          used={parseFloat(usage.storageGB.used.toFixed(2))} max={usage.storageGB.maxGB} unit=" GB" />
                <MeterBar label="Orders (month)"   used={usage.ordersMonth.used} max={usage.ordersMonth.max} />
                <MeterBar label="API calls (today)" used={usage.apiToday.used}   max={usage.apiToday.max} />
              </div>
            </div>
          )}

          {/* Quick actions */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              onClick={() => setView('plans')}
              className="flex items-center gap-3 p-4 bg-white rounded-xl border border-slate-200 hover:border-primary/40 hover:bg-primary/5 transition text-left"
            >
              <Zap className="w-5 h-5 text-primary" />
              <div>
                <p className="font-semibold text-slate-900 text-sm">Change Plan</p>
                <p className="text-xs text-slate-500">Upgrade or switch plans</p>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400 ml-auto" />
            </button>
            <button
              onClick={() => setView('history')}
              className="flex items-center gap-3 p-4 bg-white rounded-xl border border-slate-200 hover:border-primary/40 hover:bg-primary/5 transition text-left"
            >
              <ReceiptText className="w-5 h-5 text-primary" />
              <div>
                <p className="font-semibold text-slate-900 text-sm">Billing History</p>
                <p className="text-xs text-slate-500">{invoices.length} invoice{invoices.length !== 1 ? 's' : ''}</p>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400 ml-auto" />
            </button>
          </div>
        </div>
      )}

      {/* ── Plans ────────────────────────────────────────────────────────── */}
      {view === 'plans' && (
        <PlanComparison plans={allPlans} currentPlan={currentPlanSlug} />
      )}

      {/* ── Billing History ───────────────────────────────────────────────── */}
      {view === 'history' && (
        <BillingHistory invoices={invoices} />
      )}
    </div>
  );
}

// ─── Plan Comparison ─────────────────────────────────────────────────────────

function PlanComparison({ plans, currentPlan }: { plans: PlanOption[]; currentPlan: string }) {
  const [subscribing, setSubscribing] = useState<string | null>(null);
  const [msg, setMsg]                 = useState('');

  const handleUpgrade = async (plan: string) => {
    if (plan === 'FREE') return;
    setSubscribing(plan);
    setMsg('');
    try {
      const res = await adminBillingApi.subscribe(plan);
      if (res.shortUrl) {
        window.open(res.shortUrl, '_blank');
        setMsg('Razorpay checkout opened in a new tab. Complete payment to activate.');
      }
    } catch (e: any) {
      setMsg(e?.response?.data?.message ?? 'Failed to initiate checkout.');
    } finally {
      setSubscribing(null);
    }
  };

  const sorted = [...plans].sort((a, b) => PLAN_ORDER.indexOf(a.plan) - PLAN_ORDER.indexOf(b.plan));
  const allFeatures = Array.from(new Set(sorted.flatMap(p => p.features)));

  return (
    <div className="space-y-4">
      {msg && (
        <div className="bg-blue-50 border border-blue-200 text-blue-700 rounded-lg px-4 py-3 text-sm">
          {msg}
        </div>
      )}

      {/* Plan cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {sorted.map((plan) => {
          const isCurrent = plan.plan === currentPlan;
          return (
            <div
              key={plan.plan}
              className={`bg-white rounded-xl border-2 p-5 flex flex-col ${
                isCurrent ? 'border-primary' : 'border-slate-200'
              }`}
            >
              {isCurrent && (
                <span className="self-start text-xs font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-full mb-3">
                  Current
                </span>
              )}
              <h3 className="font-bold text-slate-900 text-lg">{plan.name}</h3>
              <p className="text-slate-500 text-xs mt-1 mb-4">{plan.description}</p>
              <div className="mb-4">
                {plan.priceMonthly === 0 ? (
                  <p className="text-2xl font-bold text-slate-900">Free</p>
                ) : (
                  <>
                    <p className="text-2xl font-bold text-slate-900">{paise(plan.priceMonthly)}</p>
                    <p className="text-xs text-slate-400">/month</p>
                  </>
                )}
                {plan.trialDays > 0 && (
                  <p className="text-xs text-emerald-600 mt-1">{plan.trialDays}-day free trial</p>
                )}
              </div>

              {/* Limits */}
              <ul className="text-xs text-slate-600 space-y-1 mb-5 flex-1">
                <li>📦 {plan.limits.maxProducts < 0 ? 'Unlimited' : plan.limits.maxProducts} products</li>
                <li>👥 {plan.limits.maxStaff < 0 ? 'Unlimited' : plan.limits.maxStaff} staff members</li>
                <li>💾 {plan.limits.maxStorageGB} GB storage</li>
                <li>🛒 {plan.limits.maxOrders == null ? 'Unlimited' : plan.limits.maxOrders} orders/month</li>
              </ul>

              <button
                disabled={isCurrent || subscribing === plan.plan || plan.plan === 'FREE'}
                onClick={() => handleUpgrade(plan.plan)}
                className={`w-full py-2 rounded-lg text-sm font-semibold transition ${
                  isCurrent
                    ? 'bg-primary/10 text-primary cursor-default'
                    : plan.plan === 'FREE'
                    ? 'bg-slate-100 text-slate-400 cursor-default'
                    : 'bg-primary text-primary-foreground hover:opacity-90'
                }`}
              >
                {isCurrent ? 'Current Plan' : subscribing === plan.plan ? 'Loading…' : plan.plan === 'FREE' ? 'Contact Support' : `Upgrade to ${plan.name}`}
              </button>
            </div>
          );
        })}
      </div>

      {/* Feature comparison table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
        <table className="w-full text-sm min-w-[600px]">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="text-left px-5 py-3 font-semibold text-slate-600">Feature</th>
              {sorted.map(p => (
                <th key={p.plan} className={`text-center px-4 py-3 font-semibold ${p.plan === currentPlan ? 'text-primary' : 'text-slate-600'}`}>
                  {p.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {allFeatures.map((feature) => (
              <tr key={feature} className="hover:bg-slate-50">
                <td className="px-5 py-3 text-slate-700">{FEATURE_LABELS[feature] ?? feature}</td>
                {sorted.map(p => (
                  <td key={p.plan} className="text-center px-4 py-3">
                    {p.features.includes(feature)
                      ? <CheckCircle className="w-4 h-4 text-green-500 mx-auto" />
                      : <Lock className="w-4 h-4 text-slate-300 mx-auto" />}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Billing History ──────────────────────────────────────────────────────────

function BillingHistory({ invoices }: { invoices: BillingInvoice[] }) {
  if (invoices.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 py-16 text-center text-slate-400">
        <ReceiptText className="w-10 h-10 mx-auto mb-3 opacity-30" />
        <p>No invoices yet. Your billing history will appear here after your first payment.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
        <h3 className="font-semibold text-slate-900">Billing History</h3>
        <span className="text-xs text-slate-400">{invoices.length} invoice{invoices.length !== 1 ? 's' : ''}</span>
      </div>
      <table className="w-full text-sm">
        <thead className="bg-slate-50 border-b border-slate-200">
          <tr>
            <th className="text-left px-6 py-3 font-semibold text-slate-600">Invoice</th>
            <th className="text-left px-6 py-3 font-semibold text-slate-600">Date</th>
            <th className="text-left px-6 py-3 font-semibold text-slate-600">Plan</th>
            <th className="text-left px-6 py-3 font-semibold text-slate-600">Amount</th>
            <th className="text-left px-6 py-3 font-semibold text-slate-600">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {invoices.map((inv) => (
            <tr key={inv.id} className="hover:bg-slate-50">
              <td className="px-6 py-4 font-mono text-xs text-slate-700">{inv.invoiceNumber}</td>
              <td className="px-6 py-4 text-slate-600">
                {new Date(inv.issuedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
              </td>
              <td className="px-6 py-4 text-slate-700">{inv.plan}</td>
              <td className="px-6 py-4 font-medium text-slate-900">{paise(inv.amount)}</td>
              <td className="px-6 py-4">
                <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                  inv.status === 'PAID' ? 'bg-green-100 text-green-700' :
                  inv.status === 'FAILED' ? 'bg-red-100 text-red-700' :
                  'bg-slate-100 text-slate-600'
                }`}>
                  {inv.status}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
