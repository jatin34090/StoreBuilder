'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Heart, ShoppingBag, Star } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn, formatPrice, getDiscountedPrice } from '@/lib/utils';
import { useCartStore } from '@/store/cartStore';
import { useAuthStore } from '@/store/authStore';
import { wishlistApi } from '@/lib/api';
import { toast } from 'sonner';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
  const router = useRouter();

  const imageUrl      = product.images[0]?.url ?? '/placeholder-jewellery.jpg';
  const hoverImageUrl = product.images[1]?.url ?? null;
  const firstVariant  = product.variants[0];
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
    if (!UUID_RE.test(firstVariant.id)) {
      router.push(`/products/${product.slug}`);
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
      <div data-tv="card border" className="overflow-hidden bg-card border border-border/60 transition-all duration-400 hover:shadow-md hover:border-border rounded">
        {/* Image */}
        <div className="relative aspect-[4/5] overflow-hidden bg-muted">
          <Image
            src={imageUrl}
            alt={product.name}
            fill
            className={cn(
              'object-cover transition-all duration-700',
              hoverImageUrl ? 'group-hover:opacity-0' : 'group-hover:scale-105',
            )}
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
          />
          {hoverImageUrl && (
            <Image
              src={hoverImageUrl}
              alt=""
              fill
              aria-hidden
              className="object-cover opacity-0 group-hover:opacity-100 transition-opacity duration-700"
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            />
          )}

          {/* Badges */}
          <div className="absolute top-2.5 left-2.5 flex flex-col gap-1">
            {discount > 0 && (
              <Badge variant="destructive" className="text-[10px] px-1.5 py-0.5 font-medium rounded-sm">
                -{discount}%
              </Badge>
            )}
            {product.isFeatured && !discount && (
              <Badge variant="gold" className="text-[10px] px-1.5 py-0.5 rounded-sm">
                Featured
              </Badge>
            )}
            {!inStock && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0.5 rounded-sm">
                Sold Out
              </Badge>
            )}
          </div>

          {/* Wishlist button */}
          <button
            className={cn(
              'absolute top-2.5 right-2.5 w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200',
              'bg-background/80 backdrop-blur-sm border border-border/50',
              'opacity-0 group-hover:opacity-100 translate-y-1 group-hover:translate-y-0',
              'hover:bg-background hover:border-primary/30',
            )}
            onClick={handleWishlistToggle}
            disabled={wishlistLoading}
            aria-label={wishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
          >
            <Heart
              className={cn('h-3.5 w-3.5 transition-colors', wishlisted ? 'fill-red-500 text-red-500' : 'text-muted-foreground')}
            />
          </button>

          {/* Add to cart — slides up on hover */}
          {inStock && (
            <div className="absolute bottom-0 inset-x-0 translate-y-full group-hover:translate-y-0 transition-transform duration-300">
              <button
                data-tv="foreground background primary"
                className="w-full h-10 text-xs font-medium tracking-wider flex items-center justify-center gap-2 transition-colors duration-200"
                style={{
                  backgroundColor: 'hsl(var(--foreground))',
                  color: 'hsl(var(--background))',
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                }}
                onClick={handleAddToCart}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'hsl(var(--primary))')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'hsl(var(--foreground))')}
              >
                <ShoppingBag className="h-3.5 w-3.5" />
                Add to Bag
              </button>
            </div>
          )}
        </div>

        {/* Info */}
        <div className="p-3.5">
          <h3
            className="font-display font-normal leading-snug text-foreground group-hover:text-primary transition-colors duration-200 line-clamp-2 mb-2"
            style={{ fontSize: '0.9375rem' }}
          >
            {product.name}
          </h3>

          {/* Rating */}
          {(product._count?.reviews ?? 0) > 0 && (
            <div className="flex items-center gap-1 mb-1.5">
              <Star className="h-3 w-3 fill-primary text-primary" />
              <span className="text-xs text-muted-foreground">
                {product.avgRating?.toFixed(1) ?? '—'}{' '}
                <span className="opacity-60">({product._count?.reviews})</span>
              </span>
            </div>
          )}

          {/* Price */}
          <div className="flex items-baseline gap-2">
            <span className="font-semibold text-primary" style={{ fontSize: '0.9375rem' }}>
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
