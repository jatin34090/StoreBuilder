'use client';

import { Suspense, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { MainLayout } from '@/components/layout/MainLayout';
import { ProductCard } from '@/components/product/ProductCard';
import { ProductGridSkeleton } from '@/components/product/ProductCardSkeleton';
import { searchApi } from '@/lib/api';
import { useDebounce } from '@/hooks/useDebounce';

function SearchPageContent() {
  const sp = useSearchParams();
  const router = useRouter();
  const [input, setInput] = useState(sp.get('q') ?? '');
  const debouncedQ = useDebounce(input, 400);

  const { data, isLoading } = useQuery({
    queryKey: ['search', debouncedQ],
    queryFn: () => searchApi.search({ q: debouncedQ, limit: 24 }),
    enabled: debouncedQ.length > 0,
  });

  const results = data?.data?.data?.results ?? [];
  const total   = data?.data?.data?.pagination?.total ?? 0;

  useEffect(() => {
    const url = input ? `/search?q=${encodeURIComponent(input)}` : '/search';
    window.history.replaceState(null, '', url);
  }, [input]);

  return (
    <MainLayout>
      <div className="container py-8 max-w-5xl">
        <div className="relative max-w-xl mb-8">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input
            autoFocus
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Search for rings, necklaces, earrings…"
            className="pl-10 pr-10 h-12 text-base"
          />
          {input && (
            <button
              onClick={() => setInput('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {!input && (
          <div>
            <p className="text-sm font-medium mb-3 text-muted-foreground">Popular searches</p>
            <div className="flex flex-wrap gap-2">
              {['Gold rings', 'Pearl necklace', 'Diamond earrings', 'Silver bangles', 'Kundan', 'Wedding jewellery'].map((s) => (
                <button
                  key={s}
                  onClick={() => setInput(s)}
                  className="px-3 py-1.5 rounded-full border text-sm hover:bg-accent hover:text-accent-foreground transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {debouncedQ && (
          <div>
            {isLoading ? (
              <ProductGridSkeleton count={8} />
            ) : results.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <Search className="h-10 w-10 mx-auto mb-3 opacity-20" />
                <p className="font-medium">No results for &quot;{debouncedQ}&quot;</p>
                <p className="text-sm mt-1">Try different keywords or browse our categories</p>
                <Button variant="outline" className="mt-4" onClick={() => router.push('/products')}>Browse All</Button>
              </div>
            ) : (
              <>
                <p className="text-sm text-muted-foreground mb-4">{total} result{total !== 1 ? 's' : ''} for &quot;{debouncedQ}&quot;</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                  {results.map((product: Parameters<typeof ProductCard>[0]['product'] & { id: string }) => (
                    <ProductCard key={product.id} product={product} />
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </MainLayout>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<MainLayout><div className="container py-8"><ProductGridSkeleton count={8} /></div></MainLayout>}>
      <SearchPageContent />
    </Suspense>
  );
}
