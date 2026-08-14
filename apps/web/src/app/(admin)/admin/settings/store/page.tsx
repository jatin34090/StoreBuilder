'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import {
  Save, Rocket, CheckCircle2, Circle, AlertTriangle,
  Store, Globe, Phone, Mail, MapPin, Clock, CreditCard,
  ExternalLink, Loader2,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../../../../components/ui/card';
import { Button } from '../../../../../components/ui/button';
import { Input } from '../../../../../components/ui/input';
import { Label } from '../../../../../components/ui/label';
import { Badge } from '../../../../../components/ui/badge';
import { adminStoreApi } from '../../../../../lib/admin-api';
import { useAdminAuthStore } from '../../../../../store/adminAuthStore';
import { setAdminStoreSlug } from '../../../../../lib/api';

// ─── Schema ──────────────────────────────────────────────────────────────────

const schema = z.object({
  name:         z.string().min(1).max(100),
  businessName: z.string().max(200).optional(),
  slug:         z.string().min(2).max(100).regex(/^[a-z0-9-]+$/, 'Only lowercase letters, numbers, hyphens'),
  description:  z.string().max(2000).optional(),
  contactEmail: z.string().email().optional().or(z.literal('')),
  phone:        z.string().max(30).optional(),
  address:      z.string().max(300).optional(),
  city:         z.string().max(100).optional(),
  state:        z.string().max(100).optional(),
  postalCode:   z.string().max(20).optional(),
  country:      z.string().max(5).optional(),
  currency:     z.string().max(10).optional(),
  timezone:     z.string().max(50).optional(),
});

type FormData = z.infer<typeof schema>;

// ─── Onboarding checklist step ────────────────────────────────────────────────

function ChecklistItem({ label, done }: { label: string; done: boolean }) {
  return (
    <div className={`flex items-center gap-3 py-2 ${done ? 'text-slate-700' : 'text-slate-500'}`}>
      {done
        ? <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
        : <Circle className="w-4 h-4 text-slate-300 flex-shrink-0" />}
      <span className={`text-sm ${done ? 'line-through text-slate-400' : ''}`}>{label}</span>
    </div>
  );
}

// ─── Status badge ─────────────────────────────────────────────────────────────

function StoreBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    ACTIVE:    { label: 'Active',    cls: 'bg-green-100 text-green-800 border-green-200' },
    SETUP:     { label: 'Setup',     cls: 'bg-amber-100 text-amber-800 border-amber-200' },
    DRAFT:     { label: 'Draft',     cls: 'bg-slate-100 text-slate-700 border-slate-200' },
    SUSPENDED: { label: 'Suspended', cls: 'bg-red-100 text-red-800 border-red-200' },
    CLOSED:    { label: 'Closed',    cls: 'bg-slate-200 text-slate-600 border-slate-300' },
  };
  const { label, cls } = map[status] ?? { label: status, cls: 'bg-slate-100 text-slate-700 border-slate-200' };
  return <Badge className={`text-xs font-medium border ${cls}`}>{label}</Badge>;
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function StoreSettingsPage() {
  const queryClient = useQueryClient();
  const { adminStore, setAdminStore } = useAdminAuthStore();
  const [slugWarning, setSlugWarning] = useState(false);

  const { data: store, isLoading } = useQuery({
    queryKey: ['admin', 'store', 'detail'],
    queryFn:  adminStoreApi.get,
  });

  const { data: progress } = useQuery({
    queryKey: ['admin', 'onboarding', 'progress'],
    queryFn:  adminStoreApi.onboardingProgress,
    enabled:  store?.status !== 'ACTIVE',
  });

  const { register, handleSubmit, reset, watch, formState: { errors, isDirty } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  useEffect(() => {
    if (store) {
      reset({
        name:         store.name ?? '',
        businessName: store.businessName ?? '',
        slug:         store.slug ?? '',
        description:  store.description ?? '',
        contactEmail: store.contactEmail ?? '',
        phone:        store.phone ?? '',
        address:      store.address ?? '',
        country:      store.country ?? 'IN',
        currency:     store.currency ?? 'INR',
        timezone:     store.timezone ?? 'Asia/Kolkata',
      });
    }
  }, [store, reset]);

  const watchedSlug = watch('slug');
  const originalSlug = store?.slug;
  useEffect(() => {
    setSlugWarning(!!originalSlug && watchedSlug !== originalSlug && isDirty);
  }, [watchedSlug, originalSlug, isDirty]);

  const updateMutation = useMutation({
    mutationFn: (data: FormData) => adminStoreApi.update(data),
    onSuccess: (updated) => {
      toast.success('Store settings saved');
      queryClient.invalidateQueries({ queryKey: ['admin', 'store', 'detail'] });
      // Refresh store context — slug may have changed
      if (updated && 'slug' in updated) {
        const slug = (updated as { slug?: string }).slug ?? adminStore?.slug;
        setAdminStore({
          id:          updated.id ?? adminStore?.id ?? '',
          name:        updated.name ?? adminStore?.name ?? '',
          slug:        slug ?? adminStore?.slug ?? '',
          status:      updated.status ?? adminStore?.status ?? '',
          plan:        updated.plan ?? adminStore?.plan ?? '',
          businessName: updated.businessName,
          industry:    updated.industry,
          logoUrl:     updated.logoUrl,
        });
        if (slug) setAdminStoreSlug(slug);
      }
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg ?? 'Failed to save settings');
    },
  });

  const launchMutation = useMutation({
    mutationFn: adminStoreApi.launch,
    onSuccess: () => {
      toast.success('Store launched! Your store is now live.');
      queryClient.invalidateQueries({ queryKey: ['admin', 'store', 'detail'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'onboarding', 'progress'] });
      setAdminStore({ ...adminStore!, status: 'ACTIVE' });
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg ?? 'Failed to launch store');
    },
  });

  const onSubmit = (data: FormData) => updateMutation.mutate(data);

  const storeUrl = store?.slug
    ? (process.env['NEXT_PUBLIC_ROOT_DOMAIN']
        ? `https://${store.slug}.${process.env['NEXT_PUBLIC_ROOT_DOMAIN']}`
        : `http://${store.slug}.localhost:3000`)
    : null;

  const percent = progress?.percent ?? 0;
  const canLaunch = percent >= 40 && store?.status !== 'SUSPENDED';
  const isSuspended = store?.status === 'SUSPENDED';

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-slate-900">{store?.name ?? 'Store Settings'}</h1>
            {store?.status && <StoreBadge status={store.status} />}
          </div>
          <p className="text-sm text-slate-500 mt-0.5">
            Plan: <span className="font-medium">{store?.plan ?? '—'}</span>
            {storeUrl && (
              <>
                {' · '}
                <a href={storeUrl} target="_blank" rel="noopener noreferrer"
                   className="text-primary hover:underline inline-flex items-center gap-1">
                  {store?.slug}
                  <ExternalLink className="w-3 h-3" />
                </a>
              </>
            )}
          </p>
        </div>

        {/* Launch / status button */}
        {store?.status !== 'ACTIVE' && !isSuspended && (
          <Button
            onClick={() => launchMutation.mutate()}
            disabled={!canLaunch || launchMutation.isPending}
            className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 flex-shrink-0"
          >
            {launchMutation.isPending
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <Rocket className="w-4 h-4" />}
            Launch Store
          </Button>
        )}
        {store?.status === 'ACTIVE' && storeUrl && (
          <a href={storeUrl} target="_blank" rel="noopener noreferrer">
            <Button variant="outline" className="gap-2 flex-shrink-0">
              <ExternalLink className="w-4 h-4" />
              View Live Store
            </Button>
          </a>
        )}
        {isSuspended && (
          <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            Store suspended. Contact support.
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main form */}
        <div className="lg:col-span-2 space-y-6">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {/* Business info */}
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Store className="w-4 h-4 text-primary" />
                  Business Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="businessName">Business Name</Label>
                    <Input id="businessName" placeholder="Jatin Jewellery" {...register('businessName')} />
                    {errors.businessName && <p className="text-xs text-red-500">{errors.businessName.message}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="name">Store Name</Label>
                    <Input id="name" placeholder="My Jewellery Store" {...register('name')} />
                    {errors.name && <p className="text-xs text-red-500">{errors.name.message}</p>}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="slug">Store URL</Label>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-slate-400 flex-shrink-0">
                      {process.env['NEXT_PUBLIC_ROOT_DOMAIN'] ? `https://` : 'http://'}
                    </span>
                    <Input id="slug" className="font-mono" placeholder="my-store" {...register('slug')} />
                    <span className="text-sm text-slate-400 flex-shrink-0">
                      .{process.env['NEXT_PUBLIC_ROOT_DOMAIN'] ?? 'localhost:3000'}
                    </span>
                  </div>
                  {errors.slug && <p className="text-xs text-red-500">{errors.slug.message}</p>}
                  {slugWarning && (
                    <p className="text-xs text-amber-600 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" />
                      Changing your URL slug will break existing links. Update bookmarks after saving.
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="description">Description</Label>
                  <textarea
                    id="description"
                    rows={3}
                    placeholder="What does your store sell?"
                    className="w-full px-3 py-2 text-sm border border-input rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                    {...register('description')}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Contact */}
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Phone className="w-4 h-4 text-primary" />
                  Contact Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="contactEmail">
                      <Mail className="w-3.5 h-3.5 inline mr-1 text-slate-400" />
                      Business Email
                    </Label>
                    <Input id="contactEmail" type="email" placeholder="hello@yourbrand.com" {...register('contactEmail')} />
                    {errors.contactEmail && <p className="text-xs text-red-500">{errors.contactEmail.message}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="phone">Phone</Label>
                    <Input id="phone" placeholder="+91 98765 43210" {...register('phone')} />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="address">
                    <MapPin className="w-3.5 h-3.5 inline mr-1 text-slate-400" />
                    Address
                  </Label>
                  <Input id="address" placeholder="123 Main Street, Area" {...register('address')} />
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  <div className="space-y-1.5 col-span-2 sm:col-span-1">
                    <Label htmlFor="country">Country</Label>
                    <Input id="country" placeholder="IN" maxLength={5} {...register('country')} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="currency">
                      <CreditCard className="w-3.5 h-3.5 inline mr-1 text-slate-400" />
                      Currency
                    </Label>
                    <Input id="currency" placeholder="INR" maxLength={10} {...register('currency')} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="timezone">
                      <Clock className="w-3.5 h-3.5 inline mr-1 text-slate-400" />
                      Timezone
                    </Label>
                    <Input id="timezone" placeholder="Asia/Kolkata" {...register('timezone')} />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Button type="submit" disabled={updateMutation.isPending || !isDirty} className="gap-2">
              {updateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {updateMutation.isPending ? 'Saving…' : 'Save Changes'}
            </Button>
          </form>
        </div>

        {/* Right panel — launch checklist */}
        <div className="space-y-4">
          {/* Setup progress */}
          {store?.status !== 'ACTIVE' && (
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Rocket className="w-4 h-4 text-primary" />
                  Launch Checklist
                </CardTitle>
                <CardDescription>Complete these steps to go live</CardDescription>
              </CardHeader>
              <CardContent>
                {/* Progress bar */}
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs text-slate-500">Setup progress</span>
                    <span className="text-xs font-semibold text-slate-700">{percent}%</span>
                  </div>
                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all duration-500"
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </div>

                {/* Step list */}
                <div className="divide-y divide-slate-50">
                  {progress?.steps?.map((step) => (
                    <ChecklistItem key={step.key} label={step.label} done={step.done} />
                  )) ?? (
                    <>
                      <ChecklistItem label="Business information" done={false} />
                      <ChecklistItem label="Store URL configured" done={false} />
                      <ChecklistItem label="Theme configured" done={false} />
                      <ChecklistItem label="First product added" done={false} />
                      <ChecklistItem label="Payment configured" done={false} />
                      <ChecklistItem label="Shipping configured" done={false} />
                    </>
                  )}
                </div>

                {canLaunch && (
                  <Button
                    className="w-full mt-4 bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
                    onClick={() => launchMutation.mutate()}
                    disabled={launchMutation.isPending}
                  >
                    {launchMutation.isPending
                      ? <Loader2 className="w-4 h-4 animate-spin" />
                      : <Rocket className="w-4 h-4" />}
                    Launch Store
                  </Button>
                )}
                {!canLaunch && !isSuspended && (
                  <p className="text-xs text-slate-500 mt-3 text-center">
                    Complete at least 40% of setup to launch
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Store is live */}
          {store?.status === 'ACTIVE' && storeUrl && (
            <Card className="border-0 shadow-sm border-l-4 border-l-green-500">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-green-700 mb-2">
                  <CheckCircle2 className="w-5 h-5" />
                  <span className="font-semibold text-sm">Store is Live</span>
                </div>
                <a
                  href={storeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-sm text-primary hover:underline"
                >
                  <Globe className="w-4 h-4" />
                  {storeUrl.replace(/^https?:\/\//, '')}
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
                <button
                  onClick={() => navigator.clipboard.writeText(storeUrl).then(() => toast.success('URL copied!'))}
                  className="text-xs text-slate-500 hover:text-slate-700 mt-1 transition-colors"
                >
                  Copy store link
                </button>
              </CardContent>
            </Card>
          )}

          {/* Plan info */}
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-slate-700">Current Plan</span>
                <Badge className="bg-primary/10 text-primary border-0 text-xs">{store?.plan ?? 'FREE'}</Badge>
              </div>
              <p className="text-xs text-slate-500">
                {store?._count?.products ?? 0} products · {store?._count?.orders ?? 0} orders
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
