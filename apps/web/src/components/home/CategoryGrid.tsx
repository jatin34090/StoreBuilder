import { CategoryScroller } from './CategoryScroller';

interface CategoryNode {
  id: string;
  name: string;
  slug: string;
  image?: string;
  _count?: { products: number };
  children?: CategoryNode[];
}

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001/api/v1';

async function fetchTopLevelCategories(): Promise<CategoryNode[]> {
  try {
    const res = await fetch(`${API_URL}/categories`, {
      cache: 'no-store', // always fetch fresh — reflects admin changes immediately
    });
    if (!res.ok) return [];
    const json = (await res.json()) as Record<string, unknown>;
    const tree  = (json['data'] ?? json) as CategoryNode[];
    return Array.isArray(tree) ? tree : [];
  } catch {
    return [];
  }
}

export async function CategoryGrid() {
  const categories = await fetchTopLevelCategories();

  if (categories.length === 0) return null;

  return (
    <section className="py-20 overflow-hidden">
      <div className="container mb-12 text-center">
        <p
          className="text-primary font-medium mb-3"
          style={{ fontSize: '0.7rem', letterSpacing: '0.3em', textTransform: 'uppercase' }}
        >
          Browse
        </p>
        <h2 className="font-display font-normal text-foreground text-3xl md:text-4xl">
          Shop by Category
        </h2>
      </div>

      {/*
        max-w-7xl caps at 1280 px so we never show ≥ n cards simultaneously
        (1280 − 32 px padding = 1248 px; 1248 / 212 px-per-step ≈ 5.9 < 6 = n)
      */}
      <div className="max-w-7xl mx-auto px-4 md:px-8">
        <CategoryScroller categories={categories} />
      </div>
    </section>
  );
}
