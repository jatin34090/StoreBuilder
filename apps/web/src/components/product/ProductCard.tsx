'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Heart, ShoppingBag, Star } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn, formatPrice, getDiscountedPrice } from '@/lib/utils';
import { useCartStore } from '@/store/cartStore';
import { useAuthStore } from '@/store/authStore';
import { wishlistApi } from '@/lib/api';
import { toast } from 'sonner';

export interface ProductCardProduct {
  id: string;
  name: string;
  slug: string;
  basePrice: number;
  discountPct: number;
  isFeatured: boolean;
  images: { url: string }[];
  variants: { id: string; price: number; stock: number; size?: string; color?: string; sku: string }[];
  _count?: { reviews: number };
  avgRating?: number;
}

interface ProductCardProps {
  product: ProductCardProduct;
  isWishlisted?: boolean;
  onWishlistChange?: (productId: string, wishlisted: boolean) => void;
}

export function ProductCard({ product, isWishlisted = false, onWishlistChange }: ProductCardProps) {
  const [wishlisted, setWishlisted] = useState(isWishlisted);
  const [wishlistLoading, setWishlistLoading] = useState(false);
  const { isAuthenticated } = useAuthStore();
  const addItem = useCartStore((s) => s.addItem);

  const imageUrl = product.images[0]?.url ?? '/placeholder-jewellery.jpg';
  const firstVariant = product.variants[0];
  const effectivePrice = firstVariant
    ? Number(firstVariant.price)
    : getDiscountedPrice(Number(product.basePrice), product.discountPct);
  const originalPrice = Number(product.basePrice);
  const discount = product.discountPct;
  const inStock = product.variants.some((v) => v.stock > 0);

  const handleWishlistToggle = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!isAuthenticated) {
      toast.info('Please sign in to save items to your wishlist');
      return;
    }
    setWishlistLoading(true);
    try {
      const res = await wishlistApi.toggle(product.id);
      const newState = res.data.data?.wishlisted ?? !wishlisted;
      setWishlisted(newState);
      onWishlistChange?.(product.id, newState);
      toast.success(newState ? 'Added to wishlist' : 'Removed from wishlist');
    } catch {
      toast.error('Could not update wishlist');
    } finally {
      setWishlistLoading(false);
    }
  };

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!firstVariant || firstVariant.stock === 0) {
      toast.error('Out of stock');
      return;
    }
    addItem({
      variantId:  firstVariant.id,
      productId:  product.id,
      name:       product.name,
      slug:       product.slug,
      sku:        firstVariant.sku,
      size:       firstVariant.size,
      color:      firstVariant.color,
      price:      Number(firstVariant.price),
      image:      imageUrl,
      quantity:   1,
      stock:      firstVariant.stock,
    });
    toast.success(`${product.name} added to cart`);
  };

  return (
    <Link href={`/products/${product.slug}`} className="group block">
      <div className="relative overflow-hidden rounded-lg border bg-card transition-all duration-300 hover:shadow-lg hover:-translate-y-1">
        {/* Image */}
        <div className="relative aspect-square overflow-hidden bg-gray-50">
          <Image
            src={imageUrl}
            alt={product.name}
            fill
            className="object-cover transition-transform duration-500 group-hover:scale-105"
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
          />

          {/* Badges */}
          <div className="absolute top-2 left-2 flex flex-col gap-1">
            {discount > 0 && (
              <Badge variant="destructive" className="text-xs px-1.5 py-0.5">
                -{discount}%
              </Badge>
            )}
            {product.isFeatured && (
              <Badge variant="gold" className="text-xs px-1.5 py-0.5">
                ✨ Featured
              </Badge>
            )}
            {!inStock && (
              <Badge variant="secondary" className="text-xs px-1.5 py-0.5">
                Out of stock
              </Badge>
            )}
          </div>

          {/* Actions overlay */}
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />

          <div className="absolute top-2 right-2 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            <Button
              size="icon"
              variant="secondary"
              className="h-8 w-8 rounded-full shadow-md"
              onClick={handleWishlistToggle}
              disabled={wishlistLoading}
              aria-label={wishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
            >
              <Heart
                className={cn('h-4 w-4', wishlisted ? 'fill-red-500 text-red-500' : '')}
              />
            </Button>
          </div>

          {inStock && (
            <div className="absolute bottom-0 inset-x-0 translate-y-full group-hover:translate-y-0 transition-transform duration-200">
              <Button
                className="w-full rounded-none h-9 text-xs"
                onClick={handleAddToCart}
              >
                <ShoppingBag className="h-3.5 w-3.5 mr-1.5" />
                Add to Cart
              </Button>
            </div>
          )}
        </div>

        {/* Info */}
        <div className="p-3">
          <h3 className="text-sm font-medium line-clamp-2 leading-snug text-foreground group-hover:text-primary transition-colors">
            {product.name}
          </h3>

          {/* Rating */}
          {(product._count?.reviews ?? 0) > 0 && (
            <div className="flex items-center gap-1 mt-1">
              <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
              <span className="text-xs text-muted-foreground">
                {product.avgRating?.toFixed(1) ?? '—'} ({product._count?.reviews})
              </span>
            </div>
          )}

          {/* Price */}
          <div className="flex items-center gap-2 mt-1.5">
            <span className="font-semibold text-sm text-primary">
              {formatPrice(effectivePrice)}
            </span>
            {discount > 0 && (
              <span className="text-xs text-muted-foreground line-through">
                {formatPrice(originalPrice)}
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
