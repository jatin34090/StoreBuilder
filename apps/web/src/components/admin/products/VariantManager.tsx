'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Check, X } from 'lucide-react';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Badge } from '../../ui/badge';
import { adminApi, AdminVariant } from '../../../lib/admin-api';

const variantSchema = z.object({
  sku: z.string().min(1, 'SKU is required'),
  size: z.string().optional(),
  color: z.string().optional(),
  price: z.coerce.number().positive('Price must be greater than 0'),
  stock: z.coerce.number().min(0),
  isActive: z.boolean(),
});

type VariantFormValues = z.infer<typeof variantSchema>;

interface VariantManagerProps {
  productId: string;
  variants: AdminVariant[];
}

function VariantForm({
  onSubmit,
  defaultValues,
  onCancel,
  isPending,
}: {
  onSubmit: (v: VariantFormValues) => void;
  defaultValues?: Partial<VariantFormValues>;
  onCancel: () => void;
  isPending: boolean;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<VariantFormValues>({
    resolver: zodResolver(variantSchema),
    defaultValues: {
      sku: '',
      size: '',
      color: '',
      price: 0,
      stock: 0,
      isActive: true,
      ...defaultValues,
    },
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="bg-slate-50 rounded-lg p-4 space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">SKU *</Label>
          <Input {...register('sku')} placeholder="SKU-001" className="h-8 text-sm" />
          {errors.sku && <p className="text-xs text-red-500">{errors.sku.message}</p>}
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Size</Label>
          <Input {...register('size')} placeholder="S / M / L" className="h-8 text-sm" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Color</Label>
          <Input {...register('color')} placeholder="Gold / Silver" className="h-8 text-sm" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Price (₹) *</Label>
          <Input
            type="number"
            step="0.01"
            {...register('price')}
            placeholder="0"
            className="h-8 text-sm"
          />
          {errors.price && <p className="text-xs text-red-500">{errors.price.message}</p>}
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Stock</Label>
          <Input
            type="number"
            min="0"
            {...register('stock')}
            placeholder="0"
            className="h-8 text-sm"
          />
        </div>
        <div className="flex items-end gap-2 pb-0.5">
          <input type="checkbox" id="variantIsActive" {...register('isActive')} className="h-4 w-4" />
          <Label htmlFor="variantIsActive" className="text-xs cursor-pointer">
            Active
          </Label>
        </div>
      </div>
      <div className="flex gap-2 justify-end">
        <Button type="button" variant="outline" size="sm" onClick={onCancel} disabled={isPending}>
          <X className="w-3 h-3 mr-1" /> Cancel
        </Button>
        <Button type="submit" size="sm" disabled={isPending}>
          <Check className="w-3 h-3 mr-1" /> {isPending ? 'Saving...' : 'Save Variant'}
        </Button>
      </div>
    </form>
  );
}

export function VariantManager({ productId, variants }: VariantManagerProps) {
  const queryClient = useQueryClient();
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['admin', 'products'] });
  };

  const addMutation = useMutation({
    mutationFn: (data: unknown) => adminApi.products.addVariant(productId, data),
    onSuccess: () => {
      invalidate();
      toast.success('Variant added');
      setShowAddForm(false);
    },
    onError: () => toast.error('Failed to add variant'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ variantId, data }: { variantId: string; data: unknown }) =>
      adminApi.products.updateVariant(productId, variantId, data),
    onSuccess: () => {
      invalidate();
      toast.success('Variant updated');
      setEditingId(null);
    },
    onError: () => toast.error('Failed to update variant'),
  });

  const deleteMutation = useMutation({
    mutationFn: (variantId: string) => adminApi.products.deleteVariant(productId, variantId),
    onSuccess: () => {
      invalidate();
      toast.success('Variant deleted');
    },
    onError: () => toast.error('Failed to delete variant'),
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-700">
          Variants ({variants.length})
        </h3>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => setShowAddForm(true)}
          disabled={showAddForm}
        >
          <Plus className="w-3 h-3 mr-1" /> Add Variant
        </Button>
      </div>

      {showAddForm && (
        <VariantForm
          onSubmit={(v) => addMutation.mutate(v)}
          onCancel={() => setShowAddForm(false)}
          isPending={addMutation.isPending}
        />
      )}

      <div className="space-y-2">
        {variants.length === 0 && !showAddForm && (
          <p className="text-sm text-slate-400 text-center py-4">
            No variants yet. Add a variant to set pricing and stock.
          </p>
        )}
        {variants.map((variant) =>
          editingId === variant.id ? (
            <VariantForm
              key={variant.id}
              defaultValues={{
                sku: variant.sku,
                size: variant.size,
                color: variant.color,
                price: Number(variant.price ?? 0),
                stock: variant.stock,
                isActive: variant.isActive,
              }}
              onSubmit={(v) => updateMutation.mutate({ variantId: variant.id, data: v })}
              onCancel={() => setEditingId(null)}
              isPending={updateMutation.isPending}
            />
          ) : (
            <div
              key={variant.id}
              className="flex items-center justify-between bg-white border border-slate-200 rounded-lg px-4 py-2.5"
            >
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-xs font-mono text-slate-600">{variant.sku}</span>
                {variant.size && (
                  <Badge variant="outline" className="text-xs">
                    {variant.size}
                  </Badge>
                )}
                {variant.color && (
                  <Badge variant="outline" className="text-xs">
                    {variant.color}
                  </Badge>
                )}
                <span className="text-sm font-medium">
                  ₹{variant.price.toLocaleString('en-IN')}
                </span>
                <span className="text-xs text-slate-500">Stock: {variant.stock}</span>
                {!variant.isActive && (
                  <Badge className="bg-red-100 text-red-700 text-xs">Inactive</Badge>
                )}
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                  onClick={() => setEditingId(variant.id)}
                >
                  <Pencil className="w-3.5 h-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 text-red-500 hover:text-red-700"
                  onClick={() => {
                    if (confirm('Delete this variant?')) {
                      deleteMutation.mutate(variant.id);
                    }
                  }}
                  disabled={deleteMutation.isPending}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          ),
        )}
      </div>
    </div>
  );
}
