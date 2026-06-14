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
  description: z.string().optional(),
  isFeatured: z.boolean(),
  attributes: z.string().optional(),
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

  const categories = categoriesData?.data ?? [];

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
        basePrice: product.basePrice,
        discountPct: product.discountedPrice
          ? Math.round((1 - product.discountedPrice / product.basePrice) * 100)
          : 0,
        description: product.description,
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
    const payload = {
      name: values.name,
      slug: values.slug,
      categoryId: values.categoryId,
      basePrice: values.basePrice,
      discountPct: values.discountPct,
      description: values.description,
      isFeatured: values.isFeatured,
      ...(attributes ? { attributes } : {}),
    };
    if (product) {
      updateMutation.mutate(payload);
    } else {
      createMutation.mutate(payload);
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
            <Label htmlFor="slug">Slug *</Label>
            <Input id="slug" {...register('slug')} placeholder="product-slug" />
            {errors.slug && <p className="text-xs text-red-500">{errors.slug.message}</p>}
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
            <Label htmlFor="description">Description</Label>
            <textarea
              id="description"
              {...register('description')}
              rows={3}
              placeholder="Product description"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>

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
