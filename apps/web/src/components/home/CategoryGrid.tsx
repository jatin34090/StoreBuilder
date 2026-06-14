import Link from 'next/link';

const CATEGORIES = [
  { name: 'Rings',               slug: 'rings',               emoji: '💍', gradient: 'from-amber-400 to-orange-500' },
  { name: 'Necklaces',           slug: 'necklaces-pendants',  emoji: '📿', gradient: 'from-purple-500 to-pink-500'  },
  { name: 'Earrings',            slug: 'earrings',            emoji: '✨', gradient: 'from-blue-400 to-cyan-500'   },
  { name: 'Bangles & Bracelets', slug: 'bangles-bracelets',   emoji: '🔮', gradient: 'from-green-400 to-teal-500'  },
];

export function CategoryGrid() {
  return (
    <section className="container py-14">
      <div className="text-center mb-8">
        <h2 className="text-2xl md:text-3xl font-bold text-foreground">Shop by Category</h2>
        <p className="text-muted-foreground mt-2">Find the perfect piece for every occasion</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {CATEGORIES.map((cat) => (
          <Link
            key={cat.slug}
            href={`/products?category=${cat.slug}`}
            className="group relative overflow-hidden rounded-xl aspect-[3/4] flex flex-col items-center justify-end p-4 text-white transition-transform duration-300 hover:-translate-y-1 hover:shadow-xl"
          >
            <div className={`absolute inset-0 bg-gradient-to-br ${cat.gradient} opacity-90 group-hover:opacity-100 transition-opacity`} />
            <div className="absolute inset-0 bg-black/20 group-hover:bg-black/10 transition-colors" />
            <div className="relative text-center">
              <div className="text-4xl mb-2">{cat.emoji}</div>
              <h3 className="font-semibold text-sm md:text-base">{cat.name}</h3>
              <p className="text-xs text-white/80 mt-0.5 group-hover:text-white transition-colors">
                Shop Now →
              </p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
