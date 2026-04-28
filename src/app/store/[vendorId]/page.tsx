'use client';
import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';
import { addToCartWithVendorGuard } from '@/lib/cart';
import { useVendor } from '@/lib/vendor-context';

interface Product {
  id: string;
  name: string;
  price: string;
  images: string[];
  stockQuantity: number;
  category: { name: string; slug: string };
  shopSection?: { id: string; name: string; slug: string } | null;
}

interface Section { id: string; name: string; slug: string; position: number }

type PaymentBadge = { id: string; provider: 'RAZORPAY' | 'UPI_MANUAL' | 'BANK_TRANSFER' | 'COD'; label: string };

const PROVIDER_LABEL: Record<PaymentBadge['provider'], string> = {
  RAZORPAY: 'Cards · UPI · Netbanking',
  UPI_MANUAL: 'UPI',
  BANK_TRANSFER: 'Bank transfer',
  COD: 'Cash on delivery',
};

export default function VendorStorePage() {
  const { vendor, theme } = useVendor();
  const [products, setProducts] = useState<Product[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [loading, setLoading]   = useState(true);
  const [catFilter, setCatFilter]         = useState('all');
  const [sectionFilter, setSectionFilter] = useState('all');
  const [paymentBadges, setPaymentBadges] = useState<PaymentBadge[]>([]);
  useEffect(() => {
    api<{ products: Product[]; sections: Section[] }>(`/api/vendors/${vendor.id}`, { auth: false })
      .then(({ products, sections }) => { setProducts(products); setSections(sections ?? []); setLoading(false); })
      .catch(() => setLoading(false));
    api<PaymentBadge[]>(`/api/payments/public/vendors/${vendor.id}/methods`, { auth: false, silent: true })
      .then((rows) => setPaymentBadges(rows ?? []))
      .catch(() => setPaymentBadges([]));
  }, [vendor.id]);

  const cats = useMemo(() => {
    const seen = new Set<string>();
    const list: { slug: string; name: string }[] = [];
    products.forEach((p) => {
      if (!seen.has(p.category.slug)) { seen.add(p.category.slug); list.push(p.category); }
    });
    return list;
  }, [products]);

  const visible = products.filter((p) => {
    if (catFilter !== 'all' && p.category.slug !== catFilter) return false;
    if (sectionFilter !== 'all' && p.shopSection?.slug !== sectionFilter) return false;
    return true;
  });

  return (
    <>
      <BannerSlider bannerUrls={vendor.bannerUrls} theme={theme} />

      {(vendor.description || paymentBadges.length > 0) && (
        <div className="border-b border-line bg-surface">
          <div className="max-w-6xl mx-auto px-6 py-4 flex flex-wrap items-center justify-between gap-3">
            {vendor.description ? (
              <p className="text-sm text-ink-700 max-w-2xl">{vendor.description}</p>
            ) : <span />}
            {paymentBadges.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs text-ink-500">Accepts</span>
                {Array.from(new Set(paymentBadges.map((b) => PROVIDER_LABEL[b.provider]))).map((label) => (
                  <span key={label} className="text-[11px] font-medium border border-line bg-canvas rounded-pill px-2 py-0.5 text-ink-700">
                    {label}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <div id="products" className="max-w-6xl mx-auto px-6 py-8">
        {sections.length > 0 && (
          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1 mb-3">
            {[{ slug: 'all', name: 'All sections' }, ...sections].map((s) => (
              <button
                key={s.slug}
                onClick={() => setSectionFilter(s.slug)}
                className="px-4 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap border transition-colors"
                style={sectionFilter === s.slug
                  ? { background: theme, color: '#fff', borderColor: theme }
                  : { background: 'transparent', color: '#374151', borderColor: '#e5e7eb' }}
              >
                {s.name}
              </button>
            ))}
          </div>
        )}
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1 mb-6">
          {[{ slug: 'all', name: `All (${products.length})` }, ...cats].map((c) => (
            <button
              key={c.slug}
              onClick={() => setCatFilter(c.slug)}
              className="px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap border transition-colors"
              style={catFilter === c.slug
                ? { background: theme, color: '#fff', borderColor: theme }
                : { background: 'transparent', color: '#374151', borderColor: '#e5e7eb' }}
            >
              {c.name}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-5">
            {Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-64 bg-surface border border-line rounded-xl animate-pulse" />)}
          </div>
        ) : visible.length === 0 ? (
          <div className="py-20 text-center text-ink-500">No products in this category yet.</div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-5">
            {visible.map((p) => (
              <ProductCard
                key={p.id}
                product={p}
                vendorId={vendor.id}
                theme={theme}
                onAddToCart={() => {
                  const ok = addToCartWithVendorGuard({
                    productId: p.id,
                    name: p.name,
                    price: Number(p.price),
                    image: p.images[0],
                    vendorId: vendor.id,
                    vendorName: vendor.shopName,
                  });
                  if (ok) toast.success(`${p.name} added to cart`);
                }}
              />
            ))}
          </div>
        )}
      </div>
    </>
  );
}

// ── BANNER SLIDER ──────────────────────────────────────────────────────────────
function BannerSlider({ bannerUrls, theme }: {
  bannerUrls: string[];
  theme: string;
}) {
  const [current, setCurrent] = useState(0);
  const [paused, setPaused]   = useState(false);
  const timerRef              = useRef<ReturnType<typeof setInterval> | null>(null);
  const slides                = bannerUrls.length > 0 ? bannerUrls : [];
  const hasSlides             = slides.length > 0;

  const next = useCallback(() => setCurrent((c) => (c + 1) % Math.max(slides.length, 1)), [slides.length]);
  const prev = useCallback(() => setCurrent((c) => (c - 1 + Math.max(slides.length, 1)) % Math.max(slides.length, 1)), [slides.length]);

  useEffect(() => {
    if (!hasSlides || slides.length < 2 || paused) return;
    timerRef.current = setInterval(next, 4500);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [hasSlides, slides.length, paused, next]);

  return (
    <div
      className="relative w-full overflow-hidden select-none"
      style={{ height: 'min(75vh, 680px)' }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {hasSlides ? (
        slides.map((url, idx) => (
          <div
            key={url}
            className="absolute inset-0 transition-opacity duration-700"
            style={{ opacity: idx === current ? 1 : 0, zIndex: idx === current ? 1 : 0 }}
          >
            <img src={url} alt="" className="w-full h-full object-cover" />
            <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/25 to-transparent" />
          </div>
        ))
      ) : (
        <div
          className="absolute inset-0"
          style={{ background: `linear-gradient(160deg, ${theme}cc 0%, ${theme}44 60%, #0002 100%)` }}
        />
      )}

      {slides.length > 1 && (
        <>
          <button
            onClick={prev}
            className="absolute left-4 top-1/2 -translate-y-1/2 z-20 h-10 w-10 rounded-full bg-black/20 hover:bg-black/45 text-white flex items-center justify-center backdrop-blur-md border border-white/20 transition-all duration-200"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
          </button>
          <button
            onClick={next}
            className="absolute right-4 top-1/2 -translate-y-1/2 z-20 h-10 w-10 rounded-full bg-black/20 hover:bg-black/45 text-white flex items-center justify-center backdrop-blur-md border border-white/20 transition-all duration-200"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
          </button>
          <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5">
            {slides.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrent(idx)}
                className="rounded-full transition-all duration-300"
                style={{
                  width: idx === current ? '28px' : '6px',
                  height: '6px',
                  background: idx === current ? '#fff' : 'rgba(255,255,255,0.45)',
                }}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function ProductCard({ product, vendorId, theme, onAddToCart }: {
  product: Product;
  vendorId: string;
  theme: string;
  onAddToCart: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const outOfStock = product.stockQuantity === 0;
  const href = `/store/${vendorId}/products/${product.id}`;

  return (
    <div
      className="group bg-surface border border-line rounded-xl overflow-hidden hover:shadow-lg transition-shadow"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <Link href={href} className="block relative aspect-square overflow-hidden bg-canvas">
        {product.images[0]
          ? <img
              src={hovered && product.images[1] ? product.images[1] : product.images[0]}
              alt={product.name}
              className="w-full h-full object-cover transition-all duration-500 group-hover:scale-105"
            />
          : <div className="w-full h-full flex items-center justify-center text-ink-400 text-sm">No image</div>}
        {outOfStock && (
          <div className="absolute inset-0 bg-white/70 flex items-center justify-center">
            <span className="text-xs font-bold text-ink-700 bg-white border border-line px-2 py-1 rounded-full">Out of stock</span>
          </div>
        )}
      </Link>
      <div className="p-3">
        <p className="text-xs text-ink-500 mb-0.5">{product.category.name}</p>
        <Link href={href} className="block font-semibold text-ink-900 text-sm line-clamp-2 hover:underline leading-snug">
          {product.name}
        </Link>
        <div className="mt-2 flex items-center justify-between gap-2">
          <span className="font-bold text-ink-900">₹{Number(product.price).toLocaleString('en-IN')}</span>
          {!outOfStock && (
            <button
              onClick={onAddToCart}
              className="text-xs font-semibold px-3 py-1.5 rounded-pill text-white transition-opacity hover:opacity-85"
              style={{ background: theme }}
            >
              Add
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
