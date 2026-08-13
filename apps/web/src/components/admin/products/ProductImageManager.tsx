'use client';

import React, { useRef, useState } from 'react';
import Image from 'next/image';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Upload, Trash2, ArrowUp, ArrowDown, Star, ImageIcon } from 'lucide-react';
import { Button } from '../../ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../ui/dialog';
import { adminApi } from '../../../lib/admin-api';

interface ProductImage {
  id: string;
  url: string;
  isPrimary?: boolean;
  sortOrder?: number;
  variantId?: string | null;
}

interface AdminVariant {
  id: string;
  sku: string;
  size?: string;
  color?: string;
}

interface ProductImageManagerProps {
  productId: string;
  productName: string;
  open: boolean;
  onClose: () => void;
}

export function ProductImageManager({ productId, productName, open, onClose }: ProductImageManagerProps) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [localOrder, setLocalOrder] = useState<ProductImage[] | null>(null);
  const [uploadVariantId, setUploadVariantId] = useState<string>('');

  // Fetch full product (includes all images ordered by isPrimary desc, sortOrder asc)
  const { data: product, isLoading } = useQuery({
    queryKey: ['admin', 'product', productId],
    queryFn: () => adminApi.products.get(productId),
    enabled: open && !!productId,
  });

  const images: ProductImage[] = localOrder ?? (product?.images as ProductImage[] ?? []);
  const variants: AdminVariant[] = (product?.variants as AdminVariant[] ?? []);

  // ─── Upload ──────────────────────────────────────────────────────────────────
  // ─── Assign variant ───────────────────────────────────────────────────────
  const assignVariantMutation = useMutation({
    mutationFn: ({ imageId, variantId }: { imageId: string; variantId: string | null }) =>
      adminApi.products.assignImageVariant(productId, imageId, variantId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'product', productId] });
      setLocalOrder(null);
      toast.success('Variant assignment updated');
    },
    onError: () => toast.error('Failed to update variant assignment'),
  });

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    setUploading(true);
    let successCount = 0;
    for (const file of files) {
      try {
        const fd = new FormData();
        fd.append('file', file);
        await adminApi.products.uploadImage(productId, fd, uploadVariantId || undefined);
        successCount++;
      } catch {
        toast.error(`Failed to upload ${file.name}`);
      }
    }
    if (successCount > 0) {
      toast.success(`${successCount} image${successCount > 1 ? 's' : ''} uploaded`);
      setLocalOrder(null);
      queryClient.invalidateQueries({ queryKey: ['admin', 'product', productId] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'products'] });
    }
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  // ─── Delete ──────────────────────────────────────────────────────────────────
  const deleteMutation = useMutation({
    mutationFn: (imageId: string) => adminApi.products.deleteImage(productId, imageId),
    onSuccess: (_, imageId) => {
      setLocalOrder(prev => (prev ?? images).filter(img => img.id !== imageId));
      queryClient.invalidateQueries({ queryKey: ['admin', 'product', productId] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'products'] });
      toast.success('Image removed');
    },
    onError: () => toast.error('Failed to remove image'),
  });

  // ─── Reorder ─────────────────────────────────────────────────────────────────
  function move(idx: number, direction: 'up' | 'down') {
    const next = [...images];
    const target = direction === 'up' ? idx - 1 : idx + 1;
    if (target < 0 || target >= next.length) return;
    [next[idx], next[target]] = [next[target]!, next[idx]!];
    setLocalOrder(next);
  }

  const reorderMutation = useMutation({
    mutationFn: (ids: string[]) => adminApi.products.reorderImages(productId, ids),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'product', productId] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'products'] });
      toast.success('Order saved — first image is now the primary');
    },
    onError: () => toast.error('Failed to save order'),
  });

  function saveOrder() {
    if (!localOrder) return;
    reorderMutation.mutate(localOrder.map(img => img.id));
  }

  const orderChanged = !!localOrder;

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ImageIcon className="w-5 h-5 text-slate-400" />
            Images — {productName}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Upload controls */}
          <div className="flex flex-wrap items-center gap-3">
            {variants.length > 0 && (
              <select
                value={uploadVariantId}
                onChange={(e) => setUploadVariantId(e.target.value)}
                className="h-8 text-xs border border-slate-200 rounded-md px-2 bg-white text-slate-700"
              >
                <option value="">All variants</option>
                {variants.map((v) => (
                  <option key={v.id} value={v.id}>
                    {[v.color, v.size].filter(Boolean).join(' / ') || v.sku}
                  </option>
                ))}
              </select>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
              className="gap-2"
            >
              <Upload className="w-4 h-4" />
              {uploading ? 'Uploading…' : 'Upload Images'}
            </Button>
            <p className="text-xs text-slate-400">JPG, PNG, WebP · max 5 MB each · up to 10 total</p>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              className="hidden"
              onChange={handleUpload}
            />
          </div>

          {/* Image grid */}
          {isLoading ? (
            <div className="grid grid-cols-3 gap-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="aspect-square rounded-lg bg-slate-100 animate-pulse" />
              ))}
            </div>
          ) : images.length === 0 ? (
            <div
              className="flex flex-col items-center justify-center gap-3 border-2 border-dashed border-slate-200 rounded-xl py-12 cursor-pointer hover:border-primary transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              <ImageIcon className="w-10 h-10 text-slate-300" />
              <div className="text-center">
                <p className="text-sm font-medium text-slate-500">No images yet</p>
                <p className="text-xs text-slate-400 mt-0.5">Click to upload the first image</p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {images.map((img, idx) => (
                <div key={img.id} className="group rounded-xl border border-slate-200 bg-slate-50 overflow-hidden">
                  {/* Image area */}
                  <div className="relative aspect-square">
                    <Image src={img.url} alt="" fill className="object-cover" sizes="(max-width: 640px) 50vw, 33vw" />

                    {/* Primary badge */}
                    {idx === 0 && (
                      <div className="absolute top-2 left-2 flex items-center gap-1 bg-amber-400 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow">
                        <Star className="w-2.5 h-2.5 fill-white" /> Primary
                      </div>
                    )}

                    {/* Controls overlay */}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors duration-200" />
                    <div className="absolute top-2 right-2 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        type="button"
                        onClick={() => deleteMutation.mutate(img.id)}
                        disabled={deleteMutation.isPending}
                        className="w-7 h-7 bg-red-500 text-white rounded-full flex items-center justify-center shadow hover:bg-red-600"
                        title="Delete image"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className="absolute bottom-2 right-2 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        type="button"
                        onClick={() => move(idx, 'up')}
                        disabled={idx === 0}
                        className="w-7 h-7 bg-white/90 text-slate-700 rounded-full flex items-center justify-center shadow hover:bg-white disabled:opacity-30"
                        title="Move earlier"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => move(idx, 'down')}
                        disabled={idx === images.length - 1}
                        className="w-7 h-7 bg-white/90 text-slate-700 rounded-full flex items-center justify-center shadow hover:bg-white disabled:opacity-30"
                        title="Move later"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Image number */}
                    <div className="absolute bottom-2 left-2 w-5 h-5 bg-black/50 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                      {idx + 1}
                    </div>
                  </div>

                  {/* Variant assignment */}
                  {variants.length > 0 && (
                    <div className="px-2 py-1.5 border-t border-slate-100 bg-white">
                      <select
                        value={img.variantId ?? ''}
                        onChange={(e) =>
                          assignVariantMutation.mutate({
                            imageId: img.id,
                            variantId: e.target.value || null,
                          })
                        }
                        className="w-full text-[11px] border border-slate-200 rounded px-1.5 py-1 text-slate-600 bg-white"
                      >
                        <option value="">All variants</option>
                        {variants.map((v) => (
                          <option key={v.id} value={v.id}>
                            {[v.color, v.size].filter(Boolean).join(' / ') || v.sku}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Order changed — save prompt */}
          {orderChanged && (
            <div className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
              <p className="text-sm text-amber-700">
                Order changed · Image 1 will become the primary image
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setLocalOrder(null)}>Discard</Button>
                <Button size="sm" onClick={saveOrder} disabled={reorderMutation.isPending}>
                  {reorderMutation.isPending ? 'Saving…' : 'Save Order'}
                </Button>
              </div>
            </div>
          )}

          <p className="text-xs text-slate-400">
            The first image is the primary image shown on product cards and search results.
            Use the arrows to change order, then click <strong>Save Order</strong>.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
