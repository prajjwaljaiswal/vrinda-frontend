'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { ProductCard, type ProductCardData } from '@/components/storefront/ProductCard';

interface Category { id: string; name: string; slug: string; }

const METALS = ['Gold', 'Silver', 'Diamond', 'Gemstone', 'Platinum'];
const SORTS = [
  { value: 'relevance', label: 'Relevance' },
  { value: 'newest', label: 'Newest' },
  { value: 'price_asc', label: 'Price: low to high' },
  { value: 'price_desc', label: 'Price: high to low' },
  { value: 'top_rated', label: 'Top reviewed' },
];

export default function ProductsPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<ProductCardData[]>([]);
  const [category, setCategory] = useState('');
  const [metals, setMetals] = useState<string[]>([]);
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [minRating, setMinRating] = useState(0);
  const [q, setQ] = useState('');
  const [sort, setSort] = useState('relevance');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<Category[]>('/api/categories', { auth: false }).then(setCategories).catch(() => setCategories([]));
  }, []);

  async function load() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (category) params.set('category', category);
      if (q) params.set('q', q);
      const data = await api<{ items: any[] }>(`/api/products?${params}`, { auth: false });
      setItems(data.items ?? []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [category]);

  function toggleMetal(m: string) {
    setMetals((arr) => (arr.includes(m) ? arr.filter((x) => x !== m) : [...arr, m]));
  }

  const activeChips = useMemo(() => {
    const chips: { key: string; label: string; clear: () => void }[] = [];
    if (category) {
      const c = categories.find((x) => x.id === category);
      if (c) chips.push({ key: 'cat', label: c.name, clear: () => setCategory('') });
    }
    metals.forEach((m) =>
      chips.push({ key: `m-${m}`, label: m, clear: () => toggleMetal(m) })
    );
    if (minPrice || maxPrice) {
      chips.push({
        key: 'price',
        label: `₹${minPrice || 0} – ₹${maxPrice || '∞'}`,
        clear: () => { setMinPrice(''); setMaxPrice(''); },
      });
    }
    if (minRating) chips.push({ key: 'rating', label: `${minRating}★ & up`, clear: () => setMinRating(0) });
    return chips;
  }, [category, metals, minPrice, maxPrice, minRating, categories]);

  const filtered = useMemo(() => {
    return items.filter((p) => {
      const price = Number(p.price);
      if (minPrice && price < Number(minPrice)) return false;
      if (maxPrice && price > Number(maxPrice)) return false;
      if (minRating && (p.rating ?? 0) < minRating) return false;
      return true;
    });
  }, [items, minPrice, maxPrice, minRating]);

  return (
    <div className="max-w-container mx-auto px-6 py-8">
      <nav className="text-xs text-ink-500 mb-4">
        <Link href="/" className="hover:text-brand-700">Home</Link>
        <span className="mx-1.5">/</span>
        <span className="text-ink-900">All jewelry</span>
      </nav>

      <div className="grid lg:grid-cols-[240px_1fr] gap-8">
        {/* FILTER RAIL */}
        <aside className="space-y-6">
          <FilterSection title="Category" defaultOpen>
            <div className="space-y-1.5">
              <label className="flex items-center gap-2 text-sm">
                <input type="radio" name="cat" checked={category === ''} onChange={() => setCategory('')} />
                <span>All</span>
              </label>
              {categories.map((c) => (
                <label key={c.id} className="flex items-center gap-2 text-sm">
                  <input type="radio" name="cat" checked={category === c.id} onChange={() => setCategory(c.id)} />
                  <span>{c.name}</span>
                </label>
              ))}
            </div>
          </FilterSection>

          <FilterSection title="Material" defaultOpen>
            <div className="space-y-1.5">
              {METALS.map((m) => (
                <label key={m} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={metals.includes(m)} onChange={() => toggleMetal(m)} />
                  <span>{m}</span>
                </label>
              ))}
            </div>
          </FilterSection>

          <FilterSection title="Price">
            <div className="flex items-center gap-2">
              <input
                value={minPrice}
                onChange={(e) => setMinPrice(e.target.value.replace(/\D/g, ''))}
                placeholder="Min"
                className="input-field h-9 text-sm"
              />
              <span className="text-ink-500">–</span>
              <input
                value={maxPrice}
                onChange={(e) => setMaxPrice(e.target.value.replace(/\D/g, ''))}
                placeholder="Max"
                className="input-field h-9 text-sm"
              />
            </div>
          </FilterSection>

          <FilterSection title="Rating">
            <div className="space-y-1.5">
              {[4, 3, 2, 0].map((r) => (
                <label key={r} className="flex items-center gap-2 text-sm">
                  <input type="radio" name="rating" checked={minRating === r} onChange={() => setMinRating(r)} />
                  <span>{r === 0 ? 'Any' : `${r}★ & up`}</span>
                </label>
              ))}
            </div>
          </FilterSection>
        </aside>

        {/* RESULTS */}
        <section>
          <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
            <div>
              <h1 className="font-display text-2xl md:text-3xl text-ink-900">
                {category ? categories.find((c) => c.id === category)?.name ?? 'Products' : 'All jewelry'}
              </h1>
              <p className="text-sm text-ink-500 mt-0.5">
                {loading ? 'Loading…' : `${filtered.length} result${filtered.length === 1 ? '' : 's'}`}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && load()}
                placeholder="Search in results"
                className="input-field h-10 text-sm w-56"
              />
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value)}
                className="input-field h-10 text-sm w-48"
              >
                {SORTS.map((s) => (
                  <option key={s.value} value={s.value}>Sort: {s.label}</option>
                ))}
              </select>
            </div>
          </div>

          {activeChips.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-5">
              {activeChips.map((c) => (
                <button
                  key={c.key}
                  onClick={c.clear}
                  className="chip hover:border-ink-900"
                >
                  {c.label}
                  <span className="text-ink-500">×</span>
                </button>
              ))}
              <button
                onClick={() => { setCategory(''); setMetals([]); setMinPrice(''); setMaxPrice(''); setMinRating(0); }}
                className="text-xs text-brand-700 underline underline-offset-4 px-2"
              >
                Clear all
              </button>
            </div>
          )}

          {loading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-6">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="rounded-md">
                  <div className="aspect-square bg-stone-100 animate-pulse rounded-md" />
                  <div className="h-3 mt-3 bg-stone-100 rounded animate-pulse" />
                  <div className="h-3 mt-2 w-2/3 bg-stone-100 rounded animate-pulse" />
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-20 bg-surface rounded-md border border-line">
              <p className="text-ink-700 mb-2">No products match your filters.</p>
              <button
                onClick={() => { setCategory(''); setMetals([]); setMinPrice(''); setMaxPrice(''); setMinRating(0); }}
                className="btn-ghost text-sm"
              >
                Clear filters
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-6">
              {filtered.map((p) => <ProductCard key={p.id} product={p} />)}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function FilterSection({ title, children, defaultOpen = false }: { title: string; children: React.ReactNode; defaultOpen?: boolean; }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-line pb-4">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between py-1 text-sm font-semibold text-ink-900"
      >
        {title}
        <span className="text-ink-500">{open ? '−' : '+'}</span>
      </button>
      {open && <div className="mt-3">{children}</div>}
    </div>
  );
}
