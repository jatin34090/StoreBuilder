'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import {
  Check, ChevronRight, ChevronLeft, Store, Loader2,
  AlertCircle, CheckCircle2, ArrowRight, Building2,
  Gem, Sparkles, ShoppingBag, Cpu, Leaf, Globe,
} from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { api } from '../../../lib/api';
import { cn } from '../../../lib/utils';

// ─── Step definitions ─────────────────────────────────────────────────────────

type StepId = 1 | 2 | 3 | 4;

const STEPS: { id: StepId; label: string }[] = [
  { id: 1, label: 'Business' },
  { id: 2, label: 'Industry' },
  { id: 3, label: 'Store URL' },
  { id: 4, label: 'Done!' },
];

// ─── Industry options ─────────────────────────────────────────────────────────

interface Industry { id: string; label: string; description: string; icon: React.ReactNode }

const INDUSTRIES: Industry[] = [
  { id: 'JEWELLERY',   label: 'Jewellery',       description: 'Rings, necklaces, earrings & fine jewellery', icon: <Gem className="h-5 w-5" /> },
  { id: 'FASHION',     label: 'Fashion',          description: 'Clothing, accessories & lifestyle',          icon: <ShoppingBag className="h-5 w-5" /> },
  { id: 'ELECTRONICS', label: 'Electronics',      description: 'Gadgets, mobiles, laptops & tech',          icon: <Cpu className="h-5 w-5" /> },
  { id: 'BEAUTY',      label: 'Beauty',           description: 'Cosmetics, skincare & wellness',             icon: <Sparkles className="h-5 w-5" /> },
  { id: 'FOOD',        label: 'Food & Grocery',   description: 'Packaged food, snacks & grocery',           icon: <Leaf className="h-5 w-5" /> },
  { id: 'GENERAL',     label: 'Other',            description: 'Everything else — customise freely',        icon: <Globe className="h-5 w-5" /> },
];

// ─── Schemas ──────────────────────────────────────────────────────────────────

const step1Schema = z.object({
  businessName: z.string().min(2, 'Business name is required').max(120),
  name:         z.string().min(2, 'Store name is required').max(80),
  description:  z.string().max(500).optional(),
});

const step3Schema = z.object({
  slug: z
    .string()
    .min(3, 'At least 3 characters')
    .max(50, 'Max 50 characters')
    .regex(/^[a-z0-9-]+$/, 'Only lowercase letters, numbers, and hyphens'),
});

type Step1Data = z.infer<typeof step1Schema>;
type Step3Data = z.infer<typeof step3Schema>;

// ─── Progress indicator ───────────────────────────────────────────────────────

function StepBar({ current }: { current: StepId }) {
  return (
    <div className="flex items-center gap-2">
      {STEPS.map((s, i) => (
        <div key={s.id} className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <div
              className={cn(
                'flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold transition-all',
                current > s.id
                  ? 'bg-emerald-500 text-white'
                  : current === s.id
                    ? 'bg-violet-600 text-white ring-4 ring-violet-100 dark:ring-violet-900/40'
                    : 'bg-slate-200 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
              )}
            >
              {current > s.id ? <Check className="h-3.5 w-3.5" /> : s.id}
            </div>
            <span
              className={cn(
                'hidden text-xs font-medium sm:block',
                current === s.id
                  ? 'text-violet-600 dark:text-violet-400'
                  : 'text-slate-400 dark:text-slate-500',
              )}
            >
              {s.label}
            </span>
          </div>
          {i < STEPS.length - 1 && (
            <div
              className={cn(
                'h-px w-6 sm:w-12',
                current > s.id ? 'bg-emerald-400' : 'bg-slate-200 dark:bg-slate-800',
              )}
            />
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Step 1: Business info ────────────────────────────────────────────────────

function BusinessStep({ onNext }: { onNext: (d: Step1Data) => void }) {
  const { register, handleSubmit, formState: { errors } } = useForm<Step1Data>({
    resolver: zodResolver(step1Schema),
  });

  return (
    <form onSubmit={handleSubmit(onNext)} className="space-y-5">
      <div className="space-y-1.5">
        <Label htmlFor="businessName">Legal / business name</Label>
        <Input id="businessName" placeholder="Jatin Jewellery Pvt Ltd" autoFocus {...register('businessName')} />
        {errors.businessName && <p className="text-xs text-red-500">{errors.businessName.message}</p>}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="name">
          Store display name
          <span className="ml-1.5 text-xs text-slate-400">shown to customers</span>
        </Label>
        <Input id="name" placeholder="Jatin Jewellery" {...register('name')} />
        {errors.name && <p className="text-xs text-red-500">{errors.name.message}</p>}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="description">
          Short description
          <span className="ml-1.5 text-xs text-slate-400">optional</span>
        </Label>
        <Input id="description" placeholder="Fine jewellery crafted with love since 1985" {...register('description')} />
      </div>

      <Button type="submit" className="w-full">
        Continue <ChevronRight className="ml-1 h-4 w-4" />
      </Button>
    </form>
  );
}

// ─── Step 2: Industry ─────────────────────────────────────────────────────────

function IndustryStep({
  selected,
  onSelect,
  onNext,
  onBack,
}: {
  selected: string;
  onSelect: (id: string) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {INDUSTRIES.map((ind) => (
          <button
            key={ind.id}
            type="button"
            onClick={() => onSelect(ind.id)}
            className={cn(
              'flex flex-col items-start gap-2 rounded-xl border-2 p-3 text-left transition-all',
              selected === ind.id
                ? 'border-violet-500 bg-violet-50 dark:bg-violet-950/30'
                : 'border-slate-200 bg-white hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700',
            )}
          >
            <div
              className={cn(
                'flex h-9 w-9 items-center justify-center rounded-lg',
                selected === ind.id
                  ? 'bg-violet-100 text-violet-600 dark:bg-violet-900/50 dark:text-violet-400'
                  : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
              )}
            >
              {ind.icon}
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{ind.label}</p>
              <p className="text-xs text-slate-400 dark:text-slate-500">{ind.description}</p>
            </div>
          </button>
        ))}
      </div>

      <div className="flex gap-3">
        <Button type="button" variant="outline" className="flex-1" onClick={onBack}>
          <ChevronLeft className="mr-1 h-4 w-4" /> Back
        </Button>
        <Button type="button" className="flex-1" onClick={onNext}>
          Continue <ChevronRight className="ml-1 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

// ─── Step 3: Store URL ────────────────────────────────────────────────────────

function StoreUrlStep({
  storeName,
  onNext,
  onBack,
}: {
  storeName: string;
  onNext: (d: Step3Data) => void;
  onBack: () => void;
}) {
  const derived = storeName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<Step3Data>({
    resolver: zodResolver(step3Schema),
    defaultValues: { slug: derived },
  });

  const [slugStatus, setSlugStatus] = useState<'idle' | 'checking' | 'available' | 'taken'>('available');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const slug = watch('slug');

  const checkSlug = useCallback((s: string) => {
    if (!s || s.length < 3) { setSlugStatus('idle'); return; }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setSlugStatus('checking');
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await api.get('/stores/public/check-slug', { params: { slug: s } });
        const data = res.data?.data ?? res.data;
        setSlugStatus(data?.available ? 'available' : 'taken');
      } catch {
        setSlugStatus('idle');
      }
    }, 400);
  }, []);

  useEffect(() => { checkSlug(slug ?? ''); }, [slug, checkSlug]);

  // Run initial check on the derived slug
  useEffect(() => { if (derived) { setValue('slug', derived); checkSlug(derived); } }, []);

  const onSubmit = (data: Step3Data) => {
    if (slugStatus === 'taken') { toast.error('That URL is taken — try another.'); return; }
    if (slugStatus === 'checking') { toast.error('Still checking availability…'); return; }
    onNext(data);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      <div className="space-y-1.5">
        <Label htmlFor="slug">Store URL</Label>
        <div className="relative">
          <Input
            id="slug"
            placeholder={derived || 'my-store'}
            className={cn(
              'pr-9',
              slugStatus === 'available' && 'border-emerald-400 focus-visible:ring-emerald-400',
              slugStatus === 'taken' && 'border-red-400 focus-visible:ring-red-400',
            )}
            {...register('slug')}
          />
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            {slugStatus === 'checking'  && <Loader2     className="h-4 w-4 animate-spin text-slate-400" />}
            {slugStatus === 'available' && <CheckCircle2 className="h-4 w-4 text-emerald-500" />}
            {slugStatus === 'taken'     && <AlertCircle  className="h-4 w-4 text-red-500" />}
          </div>
        </div>
        {errors.slug && <p className="text-xs text-red-500">{errors.slug.message}</p>}
        {slugStatus === 'taken' && !errors.slug && (
          <p className="text-xs text-red-500">That URL is already taken — try a different one.</p>
        )}
        {slug && (
          <p className="text-xs text-slate-400">
            Your store will be at{' '}
            <span className="font-mono font-medium text-slate-700 dark:text-slate-300">
              {slug}.yourdomain.in
            </span>
          </p>
        )}
      </div>

      <div className="flex gap-3">
        <Button type="button" variant="outline" className="flex-1" onClick={onBack}>
          <ChevronLeft className="mr-1 h-4 w-4" /> Back
        </Button>
        <Button type="submit" className="flex-1" disabled={slugStatus === 'taken' || slugStatus === 'checking'}>
          Create my store <ArrowRight className="ml-1 h-4 w-4" />
        </Button>
      </div>
    </form>
  );
}

// ─── Step 4: Success ──────────────────────────────────────────────────────────

function SuccessStep({ storeName, slug }: { storeName: string; slug: string }) {
  const router = useRouter();
  return (
    <div className="flex flex-col items-center gap-6 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-950/50">
        <CheckCircle2 className="h-10 w-10 text-emerald-500" />
      </div>

      <div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
          {storeName} is ready!
        </h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Your store is live at{' '}
          <span className="font-mono font-medium text-violet-600 dark:text-violet-400">
            {slug}.yourdomain.in
          </span>
        </p>
      </div>

      <div className="w-full space-y-3">
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">What&apos;s next</p>
          <ul className="mt-2 space-y-1 text-sm text-slate-700 dark:text-slate-300">
            <li className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-emerald-500" /> Add your first product</li>
            <li className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-emerald-500" /> Configure payment methods</li>
            <li className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-emerald-500" /> Set up shipping</li>
          </ul>
        </div>
      </div>

      <div className="flex w-full flex-col gap-3 sm:flex-row">
        <Button variant="outline" className="flex-1" onClick={() => router.push('/admin')}>
          <Building2 className="mr-2 h-4 w-4" /> Go to dashboard
        </Button>
        <Button className="flex-1" onClick={() => router.push('/admin/products')}>
          Add first product <ArrowRight className="ml-1 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function OnboardingPage() {
  const [step, setStep]           = useState<StepId>(1);
  const [submitting, setSubmitting] = useState(false);
  const [industry, setIndustry]   = useState('JEWELLERY');
  const [step1Data, setStep1Data] = useState<Step1Data | null>(null);
  const [finalSlug, setFinalSlug] = useState('');
  const [finalName, setFinalName] = useState('');

  const headings: Record<StepId, { title: string; subtitle: string }> = {
    1: { title: 'Tell us about your business',  subtitle: 'This helps us customise your store.' },
    2: { title: 'What do you sell?',             subtitle: 'Choose the industry that fits best.' },
    3: { title: 'Choose your store URL',         subtitle: 'Customers will find you here.' },
    4: { title: "You're all set!",               subtitle: 'Your store is live and ready.' },
  };

  const handleStep3 = async (data: Step3Data) => {
    if (!step1Data) return;
    setSubmitting(true);
    try {
      const res = await api.post('/onboarding/store', {
        businessName: step1Data.businessName,
        name:         step1Data.name,
        description:  step1Data.description,
        slug:         data.slug,
        industry,
      });
      const created = res.data?.data ?? res.data;
      setFinalSlug(created?.slug ?? data.slug);
      setFinalName(created?.name ?? step1Data.name);
      setStep(4);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })
        ?.response?.data?.message;
      toast.error(msg ?? 'Failed to create store. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-12">
      {/* Brand */}
      <div className="mb-8 flex items-center gap-2.5">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-600 shadow-lg">
          <Store className="h-5 w-5 text-white" />
        </div>
        <span className="text-xl font-bold text-slate-900 dark:text-slate-100">StoreBuilder</span>
      </div>

      <div className="w-full max-w-xl">
        {/* Progress bar */}
        <div className="mb-8 flex justify-center">
          <StepBar current={step} />
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-950 sm:p-8">
          {step !== 4 && (
            <div className="mb-6">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                {headings[step].title}
              </h1>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                {headings[step].subtitle}
              </p>
            </div>
          )}

          {step === 1 && (
            <BusinessStep onNext={(d) => { setStep1Data(d); setStep(2); }} />
          )}

          {step === 2 && (
            <IndustryStep
              selected={industry}
              onSelect={setIndustry}
              onNext={() => setStep(3)}
              onBack={() => setStep(1)}
            />
          )}

          {step === 3 && (
            <div className={cn(submitting && 'pointer-events-none opacity-60')}>
              <StoreUrlStep
                storeName={step1Data?.name ?? ''}
                onNext={handleStep3}
                onBack={() => setStep(2)}
              />
              {submitting && (
                <div className="mt-4 flex items-center justify-center gap-2 text-sm text-slate-500">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Provisioning your store…
                </div>
              )}
            </div>
          )}

          {step === 4 && <SuccessStep storeName={finalName} slug={finalSlug} />}
        </div>

        {step !== 4 && (
          <p className="mt-4 text-center text-xs text-slate-400">
            You can change everything — name, URL, theme — later from the admin dashboard.
          </p>
        )}
      </div>
    </div>
  );
}
