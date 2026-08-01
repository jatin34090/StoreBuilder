'use client';

import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Heart, Trash2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import Image from 'next/image';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuthGuard } from '@/hooks/useAuthGuard';
import { useCartStore } from '@/store/cartStore';
import { wishlistApi } from '@/lib/api';
import { formatPrice } from '@/lib/utils';

export default function WishlistPage() {
  const { isAuthenticated, hydrated } = useAuthGuard('/auth/login?redirect=/wishlist');
  const addItem = useCartStore((s) => s.addItem);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['wishlist'],
    queryFn: () => wishlistApi.get(),
    enabled: isAuthenticated,
  });

  const items: Array<{
    id: string;
    product: {
      id: string;
      name: string;
      slug: string;
      basePrice: number;
      discountPct: number;
      images: { url: string }[];
      variants: { id: string; price: number; stock: number; sku: string; size?: string; color?: string }[];
    };
  }> = data?.data?.data?.items ?? [];

  const removeMutation = useMutation({
    mutationFn: (productId: string) => wishlistApi.remove(productId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wishlist'] });
      toast.success('Removed from wishlist');
    },
  });

  if (!hydrated || !isAuthenticated) return null;

  return (
    <MainLayout>
      <div className="container py-8 max-w-4xl">
        <h1 className="text-2xl font-bold mb-6 flex items-center gap-2">
          <Heart className="h-6 w-6 text-primary" /> My Wishlist
          {items.length > 0 && <span className="text-muted-foreground font-normal text-base">({items.length} items)</span>}
        </h1>

        {isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {[1,2,3].map((i) => <Skeleton key={i} className="aspect-square rounded-xl" />)}
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <Heart className="h-12 w-12 mx-auto mb-3 opacity-20" />
            <p className="font-medium">Your wishlist is empty</p>
            <p className="text-sm mt-1 mb-4">Save items you love and come back later</p>
            <Button asChild><Link href="/products">Explore Jewellery</Link></Button>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {items.map(({ id, product }) => {
              const variant    = product.variants[0];
              const price      = Number(variant?.price ?? product.basePrice);
              const imageUrl   = product.images[0]?.url ?? '';
              const inStock    = product.variants.some((v) => v.stock > 0);

              return (
                <div key={id} className="border rounded-xl overflow-hidden bg-card group hover:shadow-md transition-shadow">
                  <Link href={`/products/${product.slug}`} className="block relative aspect-square overflow-hidden bg-gray-50">
                    <Image src={imageUrl} alt={product.name} fill className="object-cover group-hover:scale-105 transition-transform duration-300" sizes="(max-width:768px) 50vw, 25vw" />
                  </Link>
                  <div className="p-3 space-y-2">
                    <Link href={`/products/${product.slug}`}>
                      <h3 className="text-sm font-medium line-clamp-2 hover:text-primary transition-colors">{product.name}</h3>
                    </Link>
                    <p className="text-primary font-semibold text-sm">{formatPrice(price)}</p>
                    <div className="flex gap-2">
                      {inStock && variant && (
                        <Button
                          size="sm"
                          className="flex-1 h-8 text-xs"
                          onClick={() => {
                            addItem({
                              variantId: variant.id,
                              productId: product.id,
                              name:      product.name,
                              slug:      product.slug,
                              sku:       variant.sku,
                              size:      variant.size,
                              color:     variant.color,
                              price:     Number(variant.price),
                              image:     imageUrl,
                              quantity:  1,
                              stock:     variant.stock,
                            });
                            toast.success(`${product.name} added to cart`);
                          }}
                        >
                          Add to Cart
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 w-8 p-0"
                        onClick={() => removeMutation.mutate(product.id)}
                        disabled={removeMutation.isPending}
                      >
                        {removeMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3.5 w-3.5 text-destructive" />}
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </MainLayout>
  );
}
