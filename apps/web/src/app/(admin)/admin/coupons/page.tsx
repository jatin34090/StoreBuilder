'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format } from 'date-fns';
import { Plus, Edit2, ToggleLeft, ToggleRight, Ticket } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../../../../components/ui/button';
import { Input } from '../../../../components/ui/input';
import { Label } from '../../../../components/ui/label';
import { Badge } from '../../../../components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../../../../components/ui/dialog';
import { PageHeader } from '../../../../components/admin/PageHeader';
import { TableSkeleton } from '../../../../components/admin/LoadingSkeleton';
import { adminCouponsApi, type AdminCoupon } from '../../../../lib/admin-api';

const couponSchema = z.object({
  code: z.string().min(3).max(32).toUpperCase(),
  type: z.enum(['PERCENT', 'FIXED']),
  value: z.coerce.number().min(1),
  minOrderValue: z.coerce.number().min(0).default(0),
  maxDiscount: z.coerce.number().min(0).optional(),
  usageLimit: z.coerce.number().min(1).optional(),
  expiresAt: z.string().optional(),
  isActive: z.boolean().default(true),
});
type CouponFormData = z.infer<typeof couponSchema>;

export default function CouponsPage() {
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editCoupon, setEditCoupon] = useState<AdminCoupon | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin', 'coupons'],
    queryFn: async () => {
      const res = await adminCouponsApi.list();
      return res.data;
    },
  });

  const coupons: AdminCoupon[] = Array.isArray(data) ? (data as AdminCoupon[]) : [];

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<CouponFormData>({
    resolver: zodResolver(couponSchema),
    defaultValues: { type: 'PERCENT', isActive: true, minOrderValue: 0 },
  });

  const createMutation = useMutation({
    mutationFn: (data: CouponFormData) => adminCouponsApi.create(data),
    onSuccess: () => {
      toast.success('Coupon created successfully');
      queryClient.invalidateQueries({ queryKey: ['admin', 'coupons'] });
      setModalOpen(false);
      reset();
    },
    onError: () => toast.error('Failed to create coupon'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CouponFormData> }) =>
      adminCouponsApi.update(id, data),
    onSuccess: () => {
      toast.success('Coupon updated');
      queryClient.invalidateQueries({ queryKey: ['admin', 'coupons'] });
      setModalOpen(false);
      setEditCoupon(null);
      reset();
    },
    onError: () => toast.error('Failed to update coupon'),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      adminCouponsApi.update(id, { isActive }),
    onSuccess: (_, { isActive }) => {
      toast.success(isActive ? 'Coupon activated' : 'Coupon deactivated');
      queryClient.invalidateQueries({ queryKey: ['admin', 'coupons'] });
    },
    onError: () => toast.error('Failed to toggle coupon'),
  });

  const openCreate = () => {
    setEditCoupon(null);
    reset({ type: 'PERCENT', isActive: true, minOrderValue: 0 });
    setModalOpen(true);
  };

  const openEdit = (coupon: AdminCoupon) => {
    setEditCoupon(coupon);
    reset({
      code: coupon.code,
      type: (coupon.type === 'PERCENTAGE' ? 'PERCENT' : coupon.type) as 'PERCENT' | 'FIXED',
      value: coupon.value,
      minOrderValue: coupon.minOrderValue,
      maxDiscount: coupon.maxDiscount,
      usageLimit: coupon.usageLimit,
      expiresAt: coupon.expiresAt ? coupon.expiresAt.slice(0, 10) : undefined,
      isActive: coupon.isActive,
    });
    setModalOpen(true);
  };

  const onSubmit = (formData: CouponFormData) => {
    const payload = {
      ...formData,
      expiresAt: formData.expiresAt ? new Date(formData.expiresAt).toISOString() : undefined,
    };
    if (editCoupon) {
      updateMutation.mutate({ id: editCoupon.id, data: payload });
    } else {
      createMutation.mutate(formData);
    }
  };

  const couponType = watch('type');

  return (
    <div>
      <PageHeader
        title="Coupons"
        description={`${coupons.length} coupon codes`}
        action={
          <Button onClick={openCreate} className="bg-[#4A0E8F] hover:bg-[#3d0b78]">
            <Plus className="w-4 h-4 mr-2" />
            New Coupon
          </Button>
        }
      />

      {isLoading ? (
        <TableSkeleton rows={6} cols={8} />
      ) : isError ? (
        <div className="bg-white rounded-xl border p-12 text-center">
          <p className="text-slate-500 mb-4">Failed to load coupons.</p>
          <Button variant="outline" onClick={() => refetch()}>Retry</Button>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Code</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Type</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Value</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Min Order</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Used / Limit</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Expires</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {coupons.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center">
                      <Ticket className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                      <p className="text-slate-400">No coupons yet. Create your first coupon.</p>
                    </td>
                  </tr>
                ) : coupons.map((coupon) => {
                  const isExpired = coupon.expiresAt && new Date(coupon.expiresAt) < new Date();
                  return (
                    <tr key={coupon.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3">
                        <code className="font-mono text-sm font-bold text-[#4A0E8F] bg-purple-50 px-2 py-0.5 rounded">
                          {coupon.code}
                        </code>
                      </td>
                      <td className="px-4 py-3">
                        <Badge className="bg-slate-100 text-slate-700 border-0 text-xs">
                          {String(coupon.type).includes('PERCENT') ? '%' : '₹'} {String(coupon.type).includes('PERCENT') ? 'Percentage' : 'Fixed'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 font-semibold text-slate-800">
                        {String(coupon.type).includes('PERCENT') ? `${coupon.value}%` : `₹${coupon.value}`}
                      </td>
                      <td className="px-4 py-3 text-slate-600">₹{coupon.minOrderValue}</td>
                      <td className="px-4 py-3 text-slate-600">
                        {coupon.usedCount ?? 0} / {coupon.usageLimit ?? '∞'}
                      </td>
                      <td className="px-4 py-3 text-slate-500 text-xs">
                        {coupon.expiresAt ? (
                          <span className={isExpired ? 'text-red-500' : ''}>
                            {format(new Date(coupon.expiresAt), 'dd MMM yyyy')}
                            {isExpired && ' (Expired)'}
                          </span>
                        ) : (
                          <span className="text-green-600">Never</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {coupon.isActive && !isExpired ? (
                          <Badge className="bg-green-100 text-green-700 border-0 text-xs">Active</Badge>
                        ) : (
                          <Badge className="bg-slate-100 text-slate-500 border-0 text-xs">
                            {isExpired ? 'Expired' : 'Inactive'}
                          </Badge>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => openEdit(coupon)}>
                            <Edit2 className="w-3.5 h-3.5 mr-1" />Edit
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className={`h-7 text-xs ${coupon.isActive ? 'text-slate-500' : 'text-green-600'}`}
                            onClick={() => toggleMutation.mutate({ id: coupon.id, isActive: !coupon.isActive })}
                            disabled={toggleMutation.isPending}
                          >
                            {coupon.isActive ? <ToggleLeft className="w-3.5 h-3.5" /> : <ToggleRight className="w-3.5 h-3.5" />}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create/Edit Modal */}
      <Dialog open={modalOpen} onOpenChange={(open) => { setModalOpen(open); if (!open) { setEditCoupon(null); reset(); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editCoupon ? 'Edit Coupon' : 'Create Coupon'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label>Coupon Code *</Label>
                <Input {...register('code')} placeholder="SAVE20" className="mt-1 uppercase" />
                {errors.code && <p className="text-red-500 text-xs mt-1">{errors.code.message}</p>}
              </div>
              <div>
                <Label>Discount Type *</Label>
                <select
                  {...register('type')}
                  className="mt-1 w-full h-9 px-3 border border-slate-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                >
                  <option value="PERCENT">Percentage (%)</option>
                  <option value="FIXED">Fixed Amount (₹)</option>
                </select>
              </div>
              <div>
                <Label>Value * {couponType === 'PERCENT' ? '(%)' : '(₹)'}</Label>
                <Input type="number" {...register('value')} placeholder={couponType === 'PERCENT' ? '10' : '100'} className="mt-1" min="1" />
                {errors.value && <p className="text-red-500 text-xs mt-1">{errors.value.message}</p>}
              </div>
              <div>
                <Label>Min Order Value (₹)</Label>
                <Input type="number" {...register('minOrderValue')} placeholder="0" className="mt-1" min="0" />
              </div>
              {couponType === 'PERCENT' && (
                <div>
                  <Label>Max Discount (₹)</Label>
                  <Input type="number" {...register('maxDiscount')} placeholder="500" className="mt-1" min="0" />
                </div>
              )}
              <div>
                <Label>Usage Limit</Label>
                <Input type="number" {...register('usageLimit')} placeholder="Unlimited" className="mt-1" min="1" />
              </div>
              <div>
                <Label>Expiry Date</Label>
                <Input type="date" {...register('expiresAt')} className="mt-1" />
              </div>
              <div className="flex items-center gap-2 mt-2">
                <input type="checkbox" id="isActive" {...register('isActive')} className="w-4 h-4 rounded" />
                <Label htmlFor="isActive" className="cursor-pointer">Active</Label>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => { setModalOpen(false); setEditCoupon(null); reset(); }}>Cancel</Button>
              <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending} className="bg-[#4A0E8F] hover:bg-[#3d0b78]">
                {createMutation.isPending || updateMutation.isPending ? 'Saving...' : editCoupon ? 'Update' : 'Create'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
