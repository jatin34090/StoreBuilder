'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Upload, ImageIcon, X } from 'lucide-react';
import { Button } from '../../../../components/ui/button';
import { Input } from '../../../../components/ui/input';
import { Label } from '../../../../components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../../components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../../../../components/ui/dialog';
import { PageHeader } from '../../../../components/admin/PageHeader';
import { TableSkeleton } from '../../../../components/admin/LoadingSkeleton';
import { CategoryTree } from '../../../../components/admin/categories/CategoryTree';
import { adminApi, AdminCategory } from '../../../../lib/admin-api';

const categorySchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  slug: z.string().min(1, 'Slug is required'),
  parentId: z.string().optional(),
  sortOrder: z.coerce.number().min(0),
  description: z.string().optional(),
});

type CategoryFormValues = z.infer<typeof categorySchema>;

function slugify(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export default function AdminCategoriesPage() {
  const queryClient = useQueryClient();
  const [editTarget, setEditTarget] = useState<AdminCategory | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AdminCategory | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: categoriesData, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin', 'categories'],
    queryFn: () => adminApi.categories.list(),
  });

  const categories: AdminCategory[] = categoriesData?.items ?? [];

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<CategoryFormValues>({
    resolver: zodResolver(categorySchema),
    defaultValues: { name: '', slug: '', parentId: '', sortOrder: 0, description: '' },
  });

  const nameValue = watch('name');

  useEffect(() => {
    if (!editTarget) {
      setValue('slug', slugify(nameValue ?? ''));
    }
  }, [nameValue, editTarget, setValue]);

  useEffect(() => {
    if (editTarget) {
      reset({
        name: editTarget.name,
        slug: editTarget.slug,
        parentId: editTarget.parentId ?? '',
        sortOrder: 0,
        description: editTarget.description ?? '',
      });
      setImagePreview(editTarget.image ?? null);
    } else if (isCreating) {
      reset({ name: '', slug: '', parentId: '', sortOrder: 0, description: '' });
      setImagePreview(null);
    }
  }, [editTarget, isCreating, reset]);

  const createMutation = useMutation({
    mutationFn: (data: unknown) => adminApi.categories.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'categories'] });
      toast.success('Category created');
      setIsCreating(false);
      reset();
    },
    onError: () => toast.error('Failed to create category'),
  });

  const updateMutation = useMutation({
    mutationFn: (data: unknown) => adminApi.categories.update(editTarget!.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'categories'] });
      toast.success('Category updated');
      setEditTarget(null);
      reset();
    },
    onError: () => toast.error('Failed to update category'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => adminApi.categories.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'categories'] });
      toast.success('Category deleted');
      setDeleteTarget(null);
    },
    onError: () => toast.error('Failed to delete category'),
  });

  const isPending = createMutation.isPending || updateMutation.isPending;
  const showForm = isCreating || !!editTarget;

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !editTarget) return;
    setUploadingImage(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await adminApi.categories.uploadImage(editTarget.id, formData);
      const url: string = (res.data as { imageUrl: string }).imageUrl;
      setImagePreview(url);
      queryClient.invalidateQueries({ queryKey: ['admin', 'categories'] });
      toast.success('Image uploaded');
    } catch {
      toast.error('Image upload failed');
    } finally {
      setUploadingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function handleRemoveImage() {
    if (!editTarget) return;
    try {
      await adminApi.categories.update(editTarget.id, { image: null });
      setImagePreview(null);
      queryClient.invalidateQueries({ queryKey: ['admin', 'categories'] });
      toast.success('Image removed');
    } catch {
      toast.error('Failed to remove image');
    }
  }

  function onSubmit(values: CategoryFormValues) {
    // The API derives the slug from the name; sending it is rejected by the
    // DTO whitelist, so it is intentionally omitted from the payload.
    const payload = {
      name: values.name,
      parentId: values.parentId || null,  // '' → null clears the parent (top-level)
      sortOrder: values.sortOrder,
      ...(values.description ? { description: values.description } : {}),
    };
    if (editTarget) {
      updateMutation.mutate(payload);
    } else {
      createMutation.mutate(payload);
    }
  }

  const childCount = deleteTarget
    ? categories.filter((c) => c.parentId === deleteTarget.id).length
    : 0;

  return (
    <div className="p-6 space-y-5">
      <PageHeader
        title="Categories"
        description="Organise your product catalogue"
        action={
          <Button
            onClick={() => {
              setEditTarget(null);
              setIsCreating(true);
            }}
          >
            <Plus className="w-4 h-4 mr-1" /> New Category
          </Button>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Tree */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h2 className="text-sm font-semibold text-slate-700 mb-4">
            Category Tree ({categories.length})
          </h2>
          {isLoading ? (
            <TableSkeleton rows={5} cols={1} />
          ) : isError ? (
            <div className="text-center py-8">
              <p className="text-slate-500 text-sm mb-3">Failed to load categories.</p>
              <Button variant="outline" size="sm" onClick={() => refetch()}>
                Retry
              </Button>
            </div>
          ) : (
            <CategoryTree
              categories={categories}
              onEdit={(cat) => {
                setIsCreating(false);
                setEditTarget(cat);
              }}
              onDelete={setDeleteTarget}
            />
          )}
        </div>

        {/* Right: Form */}
        {showForm ? (
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h2 className="text-sm font-semibold text-slate-700 mb-4">
              {editTarget ? `Edit — ${editTarget.name}` : 'New Category'}
            </h2>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-1">
                <Label htmlFor="catName">Name *</Label>
                <Input id="catName" {...register('name')} placeholder="Category name" />
                {errors.name && <p className="text-xs text-red-500">{errors.name.message}</p>}
              </div>
              <div className="space-y-1">
                <Label htmlFor="catSlug">Slug *</Label>
                <Input id="catSlug" {...register('slug')} placeholder="category-slug" />
                {errors.slug && <p className="text-xs text-red-500">{errors.slug.message}</p>}
              </div>
              <div className="space-y-1">
                <Label>Parent Category</Label>
                <Select
                  defaultValue={editTarget?.parentId ?? ''}
                  onValueChange={(v) => setValue('parentId', v === 'none' ? '' : v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="None (top level)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None (top level)</SelectItem>
                    {categories
                      .filter((c) => c.id !== editTarget?.id)
                      .map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>
                          {cat.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="sortOrder">Sort Order</Label>
                <Input
                  id="sortOrder"
                  type="number"
                  min="0"
                  {...register('sortOrder')}
                  placeholder="0"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="catDesc">Description</Label>
                <textarea
                  id="catDesc"
                  {...register('description')}
                  rows={3}
                  placeholder="Optional description"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </div>

              {/* Image — only available when editing (needs an existing ID) */}
              {editTarget && (
                <div className="space-y-2">
                  <Label>Category Image</Label>
                  {imagePreview ? (
                    <div className="relative w-full aspect-[3/2] rounded-lg overflow-hidden border border-slate-200 group">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={imagePreview}
                        alt="Category image"
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors duration-200 flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={uploadingImage}
                          className="bg-white text-slate-700 text-xs font-medium px-3 py-1.5 rounded-md shadow hover:bg-slate-100 flex items-center gap-1.5"
                        >
                          <Upload className="w-3.5 h-3.5" /> Replace
                        </button>
                        <button
                          type="button"
                          onClick={handleRemoveImage}
                          className="bg-red-500 text-white text-xs font-medium px-3 py-1.5 rounded-md shadow hover:bg-red-600 flex items-center gap-1.5"
                        >
                          <X className="w-3.5 h-3.5" /> Remove
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploadingImage}
                      className="w-full aspect-[3/2] border-2 border-dashed border-slate-200 rounded-lg flex flex-col items-center justify-center gap-2 text-slate-400 hover:border-primary hover:text-primary transition-colors"
                    >
                      {uploadingImage ? (
                        <span className="text-xs">Uploading…</span>
                      ) : (
                        <>
                          <ImageIcon className="w-8 h-8" />
                          <span className="text-xs font-medium">Upload image</span>
                          <span className="text-[11px]">JPG, PNG, WebP · max 5 MB</span>
                        </>
                      )}
                    </button>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={handleImageUpload}
                  />
                  <p className="text-xs text-slate-400">
                    This image is used as the background on the category card on the homepage.
                  </p>
                </div>
              )}

              <div className="flex gap-2 pt-1">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setEditTarget(null);
                    setIsCreating(false);
                    reset();
                  }}
                  disabled={isPending}
                >
                  Cancel
                </Button>
                <Button type="submit" className="flex-1" disabled={isPending}>
                  {isPending ? 'Saving...' : editTarget ? 'Update' : 'Create'}
                </Button>
              </div>
            </form>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-dashed border-slate-300 p-5 flex items-center justify-center text-slate-400">
            <p className="text-sm text-center">
              Select a category to edit or click{' '}
              <button
                className="text-slate-600 underline"
                onClick={() => setIsCreating(true)}
              >
                New Category
              </button>
            </p>
          </div>
        )}
      </div>

      {/* Delete Confirmation */}
      {deleteTarget && (
        <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Delete Category</DialogTitle>
            </DialogHeader>
            <div className="space-y-2 text-sm text-slate-600">
              <p>
                Are you sure you want to delete{' '}
                <span className="font-semibold">{deleteTarget.name}</span>?
              </p>
              {childCount > 0 && (
                <p className="text-amber-600 bg-amber-50 rounded p-2">
                  Warning: This category has {childCount} sub-categor{childCount === 1 ? 'y' : 'ies'}.
                  Deleting it may affect those categories.
                </p>
              )}
              {(deleteTarget._count?.products ?? 0) > 0 && (
                <p className="text-amber-600 bg-amber-50 rounded p-2">
                  Warning: This category contains {deleteTarget._count?.products} product
                  {deleteTarget._count?.products === 1 ? '' : 's'}.
                </p>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteTarget(null)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => deleteMutation.mutate(deleteTarget.id)}
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
