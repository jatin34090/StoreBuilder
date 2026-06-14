'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Heart, ShoppingBag, Star, ChevronLeft, Check, Truck, Shield, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { useCartStore } from '@/store/cartStore';
import { useAuthStore } from '@/store/authStore';
import { wishlistApi, reviewsApi } from '@/lib/api';
import { formatPrice, formatDate, cn } from '@/lib/utils';

interface Variant {
  id: string;
  sku: string;
  size?: string;
  color?: string;
  price: number;
  stock: number;
  weight: number;
}

interface ProductDetail {
  id: string;
  name: string;
  slug: string;
  description: string;
  basePrice: number;
  discountPct: number;
  attributes: Record<string, string>;
  tags: string[];
  isFeatured: boolean;
  isActive: boolean;
  images: { id: string; url: string; isPrimary: boolean }[];
  variants: Variant[];
  category: { id: string; name: string; slug: string };
  _count: { reviews: number };
  avgRating: number;
  reviews: {
    id: string;
    rating: number;
    title?: string;
    body?: string;
    createdAt: string;
    user: { name: string; avatar?: string };
  }[];
}

interface Props {
  product: ProductDetail;
}

export function ProductDetailClient({ product }: Props) {
  const { isAuthenticated } = useAuthStore();
  const addItem = useCartStore((s) => s.addItem);

  const [selectedVariant, setSelectedVariant] = useState<Variant>(product.variants[0]);
  const [selectedImageIdx, setSelectedImageIdx] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [wishlisted, setWishlisted] = useState(false);
  const [wishlistLoading, setWishlistLoading] = useState(false);

  // Fetch all reviews
  const { data: reviewsData } = useQuery({
    queryKey: ['reviews', product.id],
    queryFn: () => reviewsApi.list(product.id, { limit: 20 }),
    enabled: product._count.reviews > 3,
  });
  const allReviews = reviewsData?.data?.data?.reviews ?? product.reviews;

  const effectivePrice = Number(selectedVariant?.price ?? product.basePrice);
  const originalPrice  = Number(product.basePrice);
  const discount       = product.discountPct;
  const inStock        = (selectedVariant?.stock ?? 0) > 0;
  const maxQty         = Math.min(selectedVariant?.stock ?? 0, 10);

  const handleAddToCart = () => {
    if (!selectedVariant || !inStock) { toast.error('Out of stock'); return; }
    addItem({
      variantId: selectedVariant.id,
      productId: product.id,
      name:      product.name,
      slug:      product.slug,
      sku:       selectedVariant.sku,
      size:      selectedVariant.size,
      color:     selectedVariant.color,
      price:     effectivePrice,
      image:     product.images[0]?.url ?? '',
      quantity,
      stock:     selectedVariant.stock,
    });
    toast.success(`${product.name} added to cart`);
  };

  const handleWishlist = async () => {
    if (!isAuthenticated) { toast.info('Please sign in to save to wishlist'); return; }
    setWishlistLoading(true);
    try {
      const res = await wishlistApi.toggle(product.id);
      const newState = res.data.data?.wishlisted ?? !wishlisted;
      setWishlisted(newState);
      toast.success(newState ? 'Added to wishlist' : 'Removed from wishlist');
    } catch { toast.error('Could not update wishlist'); }
    finally { setWishlistLoading(false); }
  };

  const attrs = product.attributes as Record<string, string>;

  return (
    <div className="container py-6 max-w-6xl">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm text-muted-foreground mb-6">
        <Link href="/" className="hover:text-primary">Home</Link>
        <span>/</span>
        <Link href="/products" className="hover:text-primary">Jewellery</Link>
        <span>/</span>
        <Link href={`/products?category=${product.category.slug}`} className="hover:text-primary">
          {product.category.name}
        </Link>
        <span>/</span>
        <span className="text-foreground truncate max-w-[200px]">{product.name}</span>
      </nav>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
        {/* ─── Images ──────────────────────────────────────────────────── */}
        <div className="space-y-3">
          <div className="relative aspect-square overflow-hidden rounded-xl bg-gray-50">
            <Image
              src={product.images[selectedImageIdx]?.url ?? '/placeholder-jewellery.jpg'}
              alt={product.name}
              fill
              className="object-cover"
              priority
              sizes="(max-width: 1024px) 100vw, 50vw"
            />
            {discount > 0 && (
              <Badge variant="destructive" className="absolute top-3 left-3 text-sm px-2 py-1">
                -{discount}% OFF
              </Badge>
            )}
            {product.isFeatured && (
              <Badge variant="gold" className="absolute top-3 right-3">✨ Featured</Badge>
            )}
          </div>
          {/* Thumbnails */}
          {product.images.length > 1 && (
            <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
              {product.images.map((img, idx) => (
                <button
                  key={img.id}
                  onClick={() => setSelectedImageIdx(idx)}
                  className={cn(
                    'relative w-16 h-16 rounded-lg overflow-hidden border-2 shrink-0 transition-colors',
                    idx === selectedImageIdx ? 'border-primary' : 'border-transparent hover:border-muted-foreground',
                  )}
                >
                  <Image src={img.url} alt="" fill className="object-cover" sizes="64px" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ─── Info ────────────────────────────────────────────────────── */}
        <div className="space-y-5">
          {/* Category */}
          <Link href={`/products?category=${product.category.slug}`}>
            <Badge variant="outline" className="hover:bg-accent">{product.category.name}</Badge>
          </Link>

          <h1 className="text-2xl md:text-3xl font-bold text-foreground leading-snug">
            {product.name}
          </h1>

          {/* Rating */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((s) => (
                <Star
                  key={s}
                  className={cn('h-4 w-4', s <= Math.round(product.avgRating) ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground')}
                />
              ))}
            </div>
            <span className="text-sm font-medium">{product.avgRating > 0 ? product.avgRating.toFixed(1) : 'No ratings'}</span>
            <span className="text-sm text-muted-foreground">({product._count.reviews} reviews)</span>
          </div>

          {/* Price */}
          <div className="flex items-baseline gap-3">
            <span className="text-3xl font-bold text-primary">{formatPrice(effectivePrice)}</span>
            {discount > 0 && (
              <>
                <span className="text-lg text-muted-foreground line-through">{formatPrice(originalPrice)}</span>
                <Badge variant="success">Save {formatPrice(originalPrice - effectivePrice)}</Badge>
              </>
            )}
          </div>

          <Separator />

          {/* Color variants (grouped) */}
          {product.variants.some((v) => v.color) && (
            <div>
              <p className="text-sm font-medium mb-2">
                Color: <span className="text-muted-foreground">{selectedVariant?.color}</span>
              </p>
              <div className="flex flex-wrap gap-2">
                {[...new Set(product.variants.map((v) => v.color))].map((color) => {
                  const variantWithColor = product.variants.find((v) => v.color === color && (!selectedVariant?.size || v.size === selectedVariant.size));
                  const isSelected = selectedVariant?.color === color;
                  return (
                    <button
                      key={color}
                      onClick={() => {
                        if (variantWithColor) { setSelectedVariant(variantWithColor); setQuantity(1); }
                      }}
                      className={cn(
                        'px-3 py-1.5 rounded-full border text-sm transition-all',
                        isSelected ? 'border-primary bg-primary text-primary-foreground' : 'border-input hover:border-primary',
                        !variantWithColor || variantWithColor.stock === 0 ? 'opacity-40 cursor-not-allowed' : '',
                      )}
                    >
                      {color}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Size variants */}
          {product.variants.some((v) => v.size) && (
            <div>
              <p className="text-sm font-medium mb-2">
                Size: <span className="text-muted-foreground">{selectedVariant?.size}</span>
              </p>
              <div className="flex flex-wrap gap-2">
                {product.variants.map((v) => (
                  <button
                    key={v.id}
                    onClick={() => { setSelectedVariant(v); setQuantity(1); }}
                    className={cn(
                      'px-3 py-1.5 rounded-md border text-sm transition-all',
                      selectedVariant?.id === v.id ? 'border-primary bg-primary/10 text-primary font-medium' : 'border-input hover:border-primary',
                      v.stock === 0 ? 'opacity-40 cursor-not-allowed line-through' : '',
                    )}
                  >
                    {v.size}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Stock status */}
          <div className="flex items-center gap-1.5 text-sm">
            {inStock ? (
              <>
                <Check className="h-4 w-4 text-green-600" />
                <span className="text-green-700 font-medium">
                  {selectedVariant.stock <= 5 ? `Only ${selectedVariant.stock} left!` : 'In Stock'}
                </span>
              </>
            ) : (
              <span className="text-destructive font-medium">Out of Stock</span>
            )}
          </div>

          {/* Quantity + CTA */}
          {inStock && (
            <div className="flex items-center gap-3">
              <div className="flex items-center border rounded-md">
                <button
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  className="px-3 py-2 text-lg hover:bg-muted transition-colors rounded-l-md"
                  disabled={quantity <= 1}
                >
                  −
                </button>
                <span className="px-4 py-2 text-sm font-medium min-w-[3rem] text-center">{quantity}</span>
                <button
                  onClick={() => setQuantity((q) => Math.min(maxQty, q + 1))}
                  className="px-3 py-2 text-lg hover:bg-muted transition-colors rounded-r-md"
                  disabled={quantity >= maxQty}
                >
                  +
                </button>
              </div>
              <Button className="flex-1 h-11" onClick={handleAddToCart}>
                <ShoppingBag className="h-4 w-4 mr-2" /> Add to Cart
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-11 w-11"
                onClick={handleWishlist}
                disabled={wishlistLoading}
                aria-label="Wishlist"
              >
                <Heart className={cn('h-4 w-4', wishlisted ? 'fill-red-500 text-red-500' : '')} />
              </Button>
            </div>
          )}

          {/* Trust badges */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { icon: Truck,      text: 'Free shipping ₹999+' },
              { icon: RotateCcw,  text: '7-day returns' },
              { icon: Shield,     text: 'Secure payment' },
            ].map(({ icon: Icon, text }) => (
              <div key={text} className="flex flex-col items-center gap-1 text-center p-2 rounded-lg bg-muted/50">
                <Icon className="h-4 w-4 text-primary" />
                <span className="text-xs text-muted-foreground leading-tight">{text}</span>
              </div>
            ))}
          </div>

          {/* Tags */}
          {product.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {product.tags.map((tag) => (
                <Link key={tag} href={`/products?q=${tag}`}>
                  <Badge variant="outline" className="hover:bg-accent text-xs">{tag}</Badge>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ─── Detail Tabs ──────────────────────────────────────────────────── */}
      <div className="mt-12">
        <Tabs defaultValue="description">
          <TabsList>
            <TabsTrigger value="description">Description</TabsTrigger>
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="reviews">Reviews ({product._count.reviews})</TabsTrigger>
          </TabsList>

          <TabsContent value="description" className="mt-6">
            <p className="text-muted-foreground leading-relaxed whitespace-pre-line max-w-2xl">
              {product.description}
            </p>
          </TabsContent>

          <TabsContent value="details" className="mt-6">
            <div className="max-w-sm">
              <table className="w-full text-sm">
                <tbody className="divide-y">
                  {Object.entries(attrs).filter(([, v]) => v).map(([key, value]) => (
                    <tr key={key}>
                      <td className="py-2.5 pr-4 text-muted-foreground capitalize font-medium w-1/2">{key}</td>
                      <td className="py-2.5">{value}</td>
                    </tr>
                  ))}
                  <tr>
                    <td className="py-2.5 pr-4 text-muted-foreground font-medium">SKU</td>
                    <td className="py-2.5 font-mono text-xs">{selectedVariant?.sku}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </TabsContent>

          <TabsContent value="reviews" className="mt-6">
            {allReviews.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground">
                <Star className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p>No reviews yet. Be the first to review this product!</p>
              </div>
            ) : (
              <div className="space-y-4 max-w-2xl">
                {allReviews.map((review: any) => (
                  <div key={review.id} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">
                          {review.user.name.charAt(0)}
                        </div>
                        <span className="text-sm font-medium">{review.user.name}</span>
                      </div>
                      <span className="text-xs text-muted-foreground">{formatDate(review.createdAt)}</span>
                    </div>
                    <div className="flex items-center gap-1 mb-1.5">
                      {[1,2,3,4,5].map((s) => (
                        <Star key={s} className={cn('h-3.5 w-3.5', s <= review.rating ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground')} />
                      ))}
                    </div>
                    {review.title && <p className="font-medium text-sm">{review.title}</p>}
                    {review.body && <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{review.body}</p>}
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
