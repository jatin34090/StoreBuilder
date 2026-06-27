'use client';

import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../../ui/dialog';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../ui/select';
import { adminApi, AdminProduct } from '../../../lib/admin-api';

const productSchema = z.object({
  name: z.string().min(3, 'Name must be at least 3 characters'),
  slug: z.string().min(1, 'Slug is required'),
  categoryId: z.string().min(1, 'Category is required'),
  basePrice: z.coerce.number().positive('Price must be greater than 0'),
  discountPct: z.coerce.number().min(0).max(90),
  description: z.string().min(10, 'Description must be at least 10 characters'),
  isFeatured: z.boolean(),
  attributes: z.string().optional(),
  // Initial variant — required when creating (the API requires ≥1 variant).
  variantSku: z.string().optional(),
  variantSize: z.string().optional(),
  variantColor: z.string().optional(),
  variantPrice: z.coerce.number().optional(),
  variantStock: z.coerce.number().min(0).optional(),
  variantWeight: z.coerce.number().optional(),
});

type ProductFormValues = z.infer<typeof productSchema>;

interface ProductFormModalProps {
  open: boolean;
  onClose: () => void;
  product?: AdminProduct | null;
}

function slugify(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export function ProductFormModal({ open, onClose, product }: ProductFormModalProps) {
  const queryClient = useQueryClient();

  const { data: categoriesData } = useQuery({
    queryKey: ['admin', 'categories'],
    queryFn: () => adminApi.categories.list(),
    enabled: open,
  });

  const categories = categoriesData?.items ?? [];

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<ProductFormValues>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: '',
      slug: '',
      categoryId: '',
      basePrice: 0,
      discountPct: 0,
      description: '',
      isFeatured: false,
      attributes: '',
    },
  });

  const nameValue = watch('name');

  useEffect(() => {
    if (product) {
      reset({
        name: product.name,
        slug: product.slug,
        categoryId: product.category.id,
        basePrice: Number(product.basePrice ?? 0),
        discountPct: product.discountPct ?? 0,
        description: product.description ?? '',
        isFeatured: product.isFeatured,
        attributes: '',
      });
    } else {
      reset({
        name: '',
        slug: '',
        categoryId: '',
        basePrice: 0,
        discountPct: 0,
        description: '',
        isFeatured: false,
        attributes: '',
      });
    }
  }, [product, reset, open]);

  useEffect(() => {
    if (!product) {
      setValue('slug', slugify(nameValue ?? ''));
    }
  }, [nameValue, product, setValue]);

  const createMutation = useMutation({
    mutationFn: (data: unknown) => adminApi.products.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'products'] });
      toast.success('Product created successfully');
      onClose();
    },
    onError: () => toast.error('Failed to create product'),
  });

  const updateMutation = useMutation({
    mutationFn: (data: unknown) => adminApi.products.update(product!.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'products'] });
      toast.success('Product updated successfully');
      onClose();
    },
    onError: () => toast.error('Failed to update product'),
  });

  const isPending = createMutation.isPending || updateMutation.isPending;

  function onSubmit(values: ProductFormValues) {
    let attributes: Record<string, string> | undefined;
    if (values.attributes) {
      try {
        attributes = JSON.parse(values.attributes);
      } catch {
        toast.error('Attributes must be valid JSON');
        return;
      }
    }
    // The API derives slug from name and rejects an explicit slug field.
    const basePayload = {
      name: values.name,
      categoryId: values.categoryId,
      basePrice: values.basePrice,
      discountPct: values.discountPct,
      description: values.description,
      isFeatured: values.isFeatured,
      ...(attributes ? { attributes } : {}),
    };
    if (product) {
      updateMutation.mutate(basePayload);
    } else {
      // Creating requires at least one variant.
      if (!values.variantSku || !values.variantSku.trim()) {
        toast.error('SKU is required for the initial variant');
        return;
      }
      if (!values.variantWeight || values.variantWeight < 0.1) {
        toast.error('Variant weight is required (minimum 0.1 g)');
        return;
      }
      const createPayload = {
        ...basePayload,
        variants: [
          {
            sku: values.variantSku.trim().toUpperCase(),
            price: values.variantPrice && values.variantPrice > 0 ? values.variantPrice : values.basePrice,
            stock: values.variantStock ?? 0,
            weight: values.variantWeight,
            ...(values.variantSize ? { size: values.variantSize } : {}),
            ...(values.variantColor ? { color: values.variantColor } : {}),
          },
        ],
      };
      createMutation.mutate(createPayload);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{product ? 'Edit Product' : 'New Product'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-2">
          <div className="space-y-1">
            <Label htmlFor="name">Name *</Label>
            <Input id="name" {...register('name')} placeholder="Product name" />
            {errors.name && <p className="text-xs text-red-500">{errors.name.message}</p>}
          </div>

          <div className="space-y-1">
            <Label htmlFor="slug">Slug (auto-generated)</Label>
            <Input id="slug" {...register('slug')} placeholder="product-slug" disabled className="bg-slate-50 text-slate-500" />
          </div>

          <div className="space-y-1">
            <Label>Category *</Label>
            <Select
              defaultValue={product?.category.id}
              onValueChange={(v) => setValue('categoryId', v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>
                    {cat.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.categoryId && (
              <p className="text-xs text-red-500">{errors.categoryId.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label htmlFor="basePrice">Base Price (₹) *</Label>
              <Input
                id="basePrice"
                type="number"
                step="0.01"
                {...register('basePrice')}
                placeholder="0"
              />
              {errors.basePrice && (
                <p className="text-xs text-red-500">{errors.basePrice.message}</p>
              )}
            </div>
            <div className="space-y-1">
              <Label htmlFor="discountPct">Discount %</Label>
              <Input
                id="discountPct"
                type="number"
                min="0"
                max="90"
                {...register('discountPct')}
                placeholder="0"
              />
              {errors.discountPct && (
                <p className="text-xs text-red-500">{errors.discountPct.message}</p>
              )}
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="description">Description *</Label>
            <textarea
              id="description"
              {...register('description')}
              rows={3}
              placeholder="Product description (min 10 characters)"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
            {errors.description && (
              <p className="text-xs text-red-500">{errors.description.message}</p>
            )}
          </div>

          {!product && (
            <div className="space-y-3 rounded-lg border border-slate-200 p-3 bg-slate-50/60">
              <p className="text-sm font-medium text-slate-700">Initial Variant *</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="variantSku" className="text-xs">SKU *</Label>
                  <Input id="variantSku" {...register('variantSku')} placeholder="RNG-GLD-01" className="uppercase" />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="variantStock" className="text-xs">Stock *</Label>
                  <Input id="variantStock" type="number" min="0" {...register('variantStock')} placeholder="0" />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="variantSize" className="text-xs">Size</Label>
                  <Input id="variantSize" {...register('variantSize')} placeholder="Optional" />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="variantColor" className="text-xs">Color</Label>
                  <Input id="variantColor" {...register('variantColor')} placeholder="Optional" />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="variantWeight" className="text-xs">Weight (g) *</Label>
                  <Input id="variantWeight" type="number" step="0.1" min="0.1" {...register('variantWeight')} placeholder="e.g. 5.0" />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="variantPrice" className="text-xs">Variant Price (₹)</Label>
                  <Input id="variantPrice" type="number" step="0.01" {...register('variantPrice')} placeholder="Base price" />
                </div>
              </div>
            </div>
          )}

          <div className="space-y-1">
            <Label htmlFor="attributes">Attributes (JSON)</Label>
            <textarea
              id="attributes"
              {...register('attributes')}
              rows={3}
              placeholder='{"material": "gold", "purity": "22k"}'
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
            <p className="text-xs text-slate-400">Enter valid JSON key-value pairs</p>
          </div>

          <div className="flex items-center gap-2">
            <input
              id="isFeatured"
              type="checkbox"
              {...register('isFeatured')}
              className="h-4 w-4 rounded border-gray-300"
            />
            <Label htmlFor="isFeatured" className="cursor-pointer">
              Featured Product
            </Label>
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Saving...' : product ? 'Update Product' : 'Create Product'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
