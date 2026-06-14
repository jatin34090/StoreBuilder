'use client';

import { useState, useCallback } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { SlidersHorizontal, X, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { ProductCard } from '@/components/product/ProductCard';
import { ProductGridSkeleton } from '@/components/product/ProductCardSkeleton';
import { searchApi } from '@/lib/api';

const SORT_OPTIONS = [
  { value: 'newest',     label: 'Newest First' },
  { value: 'price_asc',  label: 'Price: Low to High' },
  { value: 'price_desc', label: 'Price: High to Low' },
  { value: 'popular',    label: 'Most Popular' },
  { value: 'rating',     label: 'Top Rated' },
];

const PRICE_RANGES = [
  { label: 'Under ₹500',      min: 0,    max: 500  },
  { label: '₹500 – ₹1,000',  min: 500,  max: 1000 },
  { label: '₹1,000 – ₹2,000', min: 1000, max: 2000 },
  { label: 'Above ₹2,000',    min: 2000, max: undefined },
];

interface ProductsClientProps {
  searchParams: Record<string, string | string[] | undefined>;
}

export function ProductsClient({ searchParams: initialParams }: ProductsClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [filtersOpen, setFiltersOpen] = useState(false);

  const q          = sp.get('q') ?? '';
  const category   = sp.get('category') ?? '';
  const sortBy     = sp.get('sort') ?? 'newest';
  const minPrice   = sp.get('minPrice') ? Number(sp.get('minPrice')) : undefined;
  const maxPrice   = sp.get('maxPrice') ? Number(sp.get('maxPrice')) : undefined;
  const material   = sp.get('material') ?? '';
  const inStock    = sp.get('inStock') === 'true';
  const isFeatured = sp.get('featured') === 'true';
  const page       = Number(sp.get('page') ?? 1);

  const queryParams = { q, categoryId: category, sortBy, minPrice, maxPrice, material, inStock: inStock || undefined, isFeatured: isFeatured || undefined, page, limit: 24 };

  const { data, isLoading, isError } = useQuery({
    queryKey: ['products-search', queryParams],
    queryFn: () => searchApi.search(Object.fromEntries(Object.entries(queryParams).filter(([, v]) => v !== undefined && v !== ''))),
    placeholderData: (prev) => prev,
  });

  const results    = data?.data?.data?.results ?? [];
  const pagination = data?.data?.data?.pagination;
  const facets     = data?.data?.data?.facets ?? {};

  const updateParam = useCallback(
    (key: string, value: string | undefined) => {
      const params = new URLSearchParams(sp.toString());
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
      params.delete('page');
      router.push(`${pathname}?${params.toString()}`);
    },
    [router, pathname, sp],
  );

  const clearAll = () => router.push(pathname);

  const activeFilters = [
    q && { key: 'q',        label: `"${q}"` },
    category  && { key: 'category', label: category.replace(/-/g, ' ') },
    material  && { key: 'material', label: material },
    inStock   && { key: 'inStock',  label: 'In Stock' },
    isFeatured && { key: 'featured', label: 'Featured' },
    (minPrice || maxPrice) && {
      key: 'price',
      label: `₹${minPrice ?? 0}–${maxPrice ?? '∞'}`,
    },
  ].filter(Boolean) as Array<{ key: string; label: string }>;

  // ─── Filter Panel (shared between sidebar and sheet) ─────────────────────

  const FilterPanel = () => (
    <div className="space-y-6">
      {/* Category */}
      <div>
        <h3 className="font-semibold text-sm mb-3">Category</h3>
        <div className="space-y-1">
          {[
            { slug: '',                    label: 'All' },
            { slug: 'rings',               label: 'Rings' },
            { slug: 'necklaces-pendants',  label: 'Necklaces & Pendants' },
            { slug: 'earrings',            label: 'Earrings' },
            { slug: 'bangles-bracelets',   label: 'Bangles & Bracelets' },
          ].map((cat) => (
            <button
              key={cat.slug}
              onClick={() => { updateParam('category', cat.slug || undefined); setFiltersOpen(false); }}
              className={`w-full text-left px-2 py-1.5 rounded text-sm transition-colors ${
                category === cat.slug ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Price */}
      <div>
        <h3 className="font-semibold text-sm mb-3">Price Range</h3>
        <div className="space-y-1">
          {PRICE_RANGES.map((range) => {
            const active = minPrice === range.min && maxPrice === range.max;
            return (
              <button
                key={range.label}
                onClick={() => {
                  updateParam('minPrice', range.min ? String(range.min) : undefined);
                  updateParam('maxPrice', range.max ? String(range.max) : undefined);
                  setFiltersOpen(false);
                }}
                className={`w-full text-left px-2 py-1.5 rounded text-sm transition-colors ${active ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
              >
                {range.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Material facets */}
      {(facets.material?.length ?? 0) > 0 && (
        <div>
          <h3 className="font-semibold text-sm mb-3">Material</h3>
          <div className="space-y-1">
            {facets.material.map(({ value, count }: { value: string; count: number }) => (
              <button
                key={value}
                onClick={() => { updateParam('material', material === value ? undefined : value); setFiltersOpen(false); }}
                className={`w-full text-left px-2 py-1.5 rounded text-sm flex justify-between transition-colors ${material === value ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
              >
                <span>{value}</span>
                <span className="text-xs opacity-70">({count})</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* In stock toggle */}
      <div>
        <button
          onClick={() => updateParam('inStock', inStock ? undefined : 'true')}
          className={`w-full text-left px-2 py-1.5 rounded text-sm flex items-center gap-2 transition-colors ${inStock ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
        >
          <span className={`w-4 h-4 rounded border-2 flex items-center justify-center ${inStock ? 'border-current bg-current' : 'border-muted-foreground'}`}>
            {inStock && <span className="text-primary-foreground text-[10px]">✓</span>}
          </span>
          In Stock Only
        </button>
      </div>

      <Button variant="outline" size="sm" className="w-full" onClick={clearAll}>
        Clear All Filters
      </Button>
    </div>
  );

  return (
    <div>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl font-bold">
            {q ? `Results for "${q}"` : isFeatured ? 'Featured Jewellery' : 'All Jewellery'}
          </h1>
          {pagination && (
            <p className="text-sm text-muted-foreground mt-0.5">
              {pagination.total} product{pagination.total !== 1 ? 's' : ''}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Mobile filter button */}
          <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="sm" className="lg:hidden">
                <SlidersHorizontal className="h-4 w-4 mr-1.5" /> Filters
                {activeFilters.length > 0 && (
                  <Badge className="ml-1.5 h-4 w-4 p-0 text-[10px] flex items-center justify-center">
                    {activeFilters.length}
                  </Badge>
                )}
              </Button>
            </SheetTrigger>
            <SheetContent side="left">
              <SheetHeader><SheetTitle>Filters</SheetTitle></SheetHeader>
              <div className="mt-4"><FilterPanel /></div>
            </SheetContent>
          </Sheet>

          <Select value={sortBy} onValueChange={(v) => updateParam('sort', v)}>
            <SelectTrigger className="w-44 h-9 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SORT_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Active filters chips */}
      {activeFilters.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {activeFilters.map((f) => (
            <Badge
              key={f.key}
              variant="secondary"
              className="cursor-pointer hover:bg-destructive/10 hover:text-destructive"
              onClick={() => {
                if (f.key === 'price') { updateParam('minPrice', undefined); updateParam('maxPrice', undefined); }
                else updateParam(f.key, undefined);
              }}
            >
              {f.label} <X className="h-3 w-3 ml-1" />
            </Badge>
          ))}
          <button onClick={clearAll} className="text-xs text-muted-foreground hover:text-primary underline">
            Clear all
          </button>
        </div>
      )}

      <div className="flex gap-6">
        {/* Desktop sidebar */}
        <aside className="hidden lg:block w-56 shrink-0">
          <FilterPanel />
        </aside>

        {/* Results */}
        <div className="flex-1 min-w-0">
          {isLoading ? (
            <ProductGridSkeleton count={12} />
          ) : isError ? (
            <div className="text-center py-16 text-muted-foreground">
              <p>Something went wrong. Please try again.</p>
              <Button variant="outline" className="mt-4" onClick={() => router.refresh()}>Retry</Button>
            </div>
          ) : results.length === 0 ? (
            <div className="text-center py-16">
              <div className="text-5xl mb-4">💍</div>
              <h3 className="font-semibold text-lg">No products found</h3>
              <p className="text-muted-foreground mt-1">Try adjusting your filters or search query</p>
              <Button variant="outline" className="mt-4" onClick={clearAll}>Clear filters</Button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4">
                {results.map((product: Parameters<typeof ProductCard>[0]['product'] & { id: string }) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>

              {/* Pagination */}
              {pagination && pagination.pageCount > 1 && (
                <div className="flex justify-center gap-2 mt-8">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => updateParam('page', String(page - 1))}
                  >
                    ← Previous
                  </Button>
                  <span className="flex items-center text-sm text-muted-foreground px-3">
                    Page {page} of {pagination.pageCount}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= pagination.pageCount}
                    onClick={() => updateParam('page', String(page + 1))}
                  >
                    Next →
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
