"use client";
import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import { api } from "@/lib/api";
import { addToCartWithVendorGuard } from "@/lib/cart";
import { useVendor } from "@/lib/vendor-context";
import { BlockRenderer } from "@/components/blocks/BlockRenderer";
import type { Block } from "@/components/blocks/types";
import { Stars } from "@/components/storefront/ProductCard";
import { useCurrency, formatPrice } from "@/lib/currency";

interface PublishedPage {
  id: string;
  vendorId: string;
  blocks: Block[];
}

interface Product {
  id: string;
  slug?: string | null;
  name: string;
  price: string;
  images: string[];
  stockQuantity: number;
  featured?: boolean;
  createdAt?: string;
  category: { name: string; slug: string };
  shopSection?: { id: string; name: string; slug: string } | null;
}

interface Section {
  id: string;
  name: string;
  slug: string;
  position: number;
}
interface Aggregate {
  averageRating: number;
  totalReviews: number;
}
interface VendorDetail {
  createdAt?: string;
  pickupAddress?: {
    city: string | null;
    state: string | null;
    country: string | null;
  } | null;
}

type PaymentBadge = {
  id: string;
  provider: "RAZORPAY" | "UPI_MANUAL" | "BANK_TRANSFER" | "COD";
  label: string;
};

const PROVIDER_LABEL: Record<PaymentBadge["provider"], string> = {
  RAZORPAY: "Cards · UPI · Netbanking",
  UPI_MANUAL: "UPI",
  BANK_TRANSFER: "Bank transfer",
  COD: "Cash on delivery",
};

const TRUST_BADGES = [
  {
    icon: "🛡️",
    title: "Hallmarked & certified",
    body: "Every piece verified for authenticity",
  },
  {
    icon: "🚚",
    title: "Free shipping over ₹2,000",
    body: "Insured doorstep delivery",
  },
  {
    icon: "↩️",
    title: "15-day easy returns",
    body: "No-questions-asked replacements",
  },
  {
    icon: "🔒",
    title: "Secure payments",
    body: "UPI, cards, COD — all protected",
  },
];

export default function StorefrontHome() {
  const { code } = useCurrency();
  const { vendor, theme, storeKey } = useVendor();
  const [products, setProducts] = useState<Product[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [aggregate, setAggregate] = useState<Aggregate>({
    averageRating: 0,
    totalReviews: 0,
  });
  const [vendorDetail, setVendorDetail] = useState<VendorDetail>({});
  const [loading, setLoading] = useState(true);
  const [catFilter, setCatFilter] = useState("all");
  const [sectionFilter, setSectionFilter] = useState("all");
  const [paymentBadges, setPaymentBadges] = useState<PaymentBadge[]>([]);
  const [homepage, setHomepage] = useState<PublishedPage | null>(null);
  const [followed, setFollowed] = useState(false);

  useEffect(() => {
    api<{
      products: Product[];
      sections: Section[];
      aggregate: Aggregate;
      vendor: VendorDetail;
    }>(`/api/vendors/${vendor.id}`, { auth: false })
      .then(({ products, sections, aggregate, vendor: v }) => {
        setProducts(products);
        setSections(sections ?? []);
        setAggregate(aggregate ?? { averageRating: 0, totalReviews: 0 });
        setVendorDetail(v ?? {});
        setLoading(false);
      })
      .catch(() => setLoading(false));
    api<PaymentBadge[]>(`/api/payments/public/vendors/${vendor.id}/methods`, {
      auth: false,
      silent: true,
    })
      .then((rows) => setPaymentBadges(rows ?? []))
      .catch(() => setPaymentBadges([]));
    api<PublishedPage>(`/api/storefront-pages/${vendor.id}`, {
      auth: false,
      silent: true,
    })
      .then((page) => setHomepage(page))
      .catch(() => setHomepage(null));
    try {
      setFollowed(localStorage.getItem(`follow:${vendor.id}`) === "1");
    } catch {}
  }, [vendor.id]);

  function toggleFollow() {
    const next = !followed;
    setFollowed(next);
    try {
      localStorage.setItem(`follow:${vendor.id}`, next ? "1" : "0");
    } catch {}
    toast.success(
      next ? `Following ${vendor.shopName}` : `Unfollowed ${vendor.shopName}`,
    );
  }

  const cats = useMemo(() => {
    const seen = new Set<string>();
    const list: { slug: string; name: string }[] = [];
    products.forEach((p) => {
      if (!seen.has(p.category.slug)) {
        seen.add(p.category.slug);
        list.push(p.category);
      }
    });
    return list;
  }, [products]);

  const visible = products.filter((p) => {
    if (catFilter !== "all" && p.category.slug !== catFilter) return false;
    if (sectionFilter !== "all" && p.shopSection?.slug !== sectionFilter)
      return false;
    return true;
  });

  const featured = useMemo(() => {
    const f = products
      .filter((p) => p.featured && p.stockQuantity > 0)
      .slice(0, 4);
    if (f.length >= 2) return f;
    return products.filter((p) => p.stockQuantity > 0).slice(0, 4);
  }, [products]);

  // Map each section → first product image (used as the hero thumbnail)
  const sectionThumbs = useMemo(() => {
    const map: Record<string, { image: string | null; count: number }> = {};
    for (const s of sections) {
      const inSection = products.filter((p) => p.shopSection?.slug === s.slug);
      map[s.slug] = {
        image: inSection.find((p) => p.images[0])?.images[0] ?? null,
        count: inSection.length,
      };
    }
    return map;
  }, [sections, products]);

  const memberSince = vendorDetail.createdAt
    ? new Date(vendorDetail.createdAt).getFullYear()
    : null;
  const locationLabel = [
    vendorDetail.pickupAddress?.city,
    vendorDetail.pickupAddress?.state,
  ]
    .filter(Boolean)
    .join(", ");

  const hasCustomHomepage =
    homepage && Array.isArray(homepage.blocks) && homepage.blocks.length > 0;

  return (
    <>
      {hasCustomHomepage ? (
        <BlockRenderer
          blocks={homepage!.blocks}
          ctx={{ scope: "vendor", vendorId: vendor.id }}
        />
      ) : (
        <BannerSlider bannerUrls={vendor.bannerUrls} theme={theme} />
      )}

      {/* ── TRUST STRIP ──────────────────────────────────────────────────────── */}
      <div className="bg-canvas/60 border-b border-line">
        <div className="max-w-6xl mx-auto px-6 py-4 grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
          {TRUST_BADGES.map((b) => (
            <div key={b.title} className="flex items-start gap-2.5">
              <span className="text-xl leading-none mt-0.5">{b.icon}</span>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-ink-900 leading-tight">
                  {b.title}
                </p>
                <p className="text-[11px] text-ink-500 mt-0.5 leading-snug">
                  {b.body}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── FEATURED RAIL ────────────────────────────────────────────────────── */}
      {!loading && featured.length >= 2 && (
        <section className="max-w-6xl mx-auto px-6 pt-10">
          <div className="flex items-baseline justify-between mb-4">
            <h2 className="font-display text-2xl md:text-3xl text-ink-900">
              Featured pieces
            </h2>
            <a
              href="#products"
              className="text-sm font-semibold hover:underline"
              style={{ color: theme }}
            >
              See all →
            </a>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-5">
            {featured.map((p) => (
              <ProductCard
                key={p.id}
                product={p}
                vendorId={storeKey}
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
        </section>
      )}

      {/* ── SHOP SECTIONS AS HERO CARDS ──────────────────────────────────────── */}
      {!loading && sections.length > 0 && (
        <section className="max-w-6xl mx-auto px-6 pt-12">
          <h2 className="font-display text-2xl md:text-3xl text-ink-900 mb-4">
            Shop by collection
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {sections.map((s) => {
              const t = sectionThumbs[s.slug];
              if (!t || t.count === 0) return null;
              return (
                <button
                  key={s.id}
                  onClick={() => {
                    setSectionFilter(s.slug);
                    setCatFilter("all");
                    document
                      .getElementById("products")
                      ?.scrollIntoView({ behavior: "smooth" });
                  }}
                  className="group relative aspect-[3/2] rounded-xl overflow-hidden border border-line text-left hover:shadow-lg transition-shadow"
                >
                  {t.image ? (
                    <img
                      src={t.image}
                      alt=""
                      className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  ) : (
                    <div
                      className="absolute inset-0"
                      style={{
                        background: `linear-gradient(135deg, ${theme}cc, ${theme}55)`,
                      }}
                    />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                  <div className="absolute inset-x-0 bottom-0 p-4 text-white">
                    <p className="font-display text-xl leading-tight">
                      {s.name}
                    </p>
                    <p className="text-xs text-white/85 mt-0.5">
                      {t.count} piece{t.count !== 1 ? "s" : ""} · Explore →
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* ── ABOUT THE SHOP ───────────────────────────────────────────────────── */}
      {vendor.description && (
        <section id="about" className="max-w-6xl mx-auto px-6 pt-12">
          <div className="grid  gap-8 border-t border-line pt-10">
            <div>
              <h2 className="font-display text-2xl md:text-3xl text-ink-900 mb-3">
                About {vendor.shopName}
              </h2>
              <p className="text-ink-700 leading-relaxed whitespace-pre-line">
                {vendor.description}
              </p>
            </div>
            <aside className="space-y-3">
              {paymentBadges.length > 0 && (
                <div className="rounded-xl border border-line bg-surface p-5">
                  <h3 className="text-xs uppercase tracking-wide font-semibold text-ink-700 mb-3">
                    Payment methods
                  </h3>
                  <div className="flex flex-wrap gap-1.5">
                    {Array.from(
                      new Set(
                        paymentBadges.map((b) => PROVIDER_LABEL[b.provider]),
                      ),
                    ).map((label) => (
                      <span
                        key={label}
                        className="text-[11px] font-medium border border-line bg-canvas rounded-pill px-2 py-1 text-ink-700"
                      >
                        {label}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </aside>
          </div>
        </section>
      )}

      {/* ── ALL PRODUCTS ─────────────────────────────────────────────────────── */}
      <section id="products" className="max-w-6xl mx-auto px-6 pt-12 pb-16">
        <div className="border-t border-line pt-10">
          <div className="flex items-baseline justify-between mb-5">
            <h2 className="font-display text-2xl md:text-3xl text-ink-900">
              Shop all
            </h2>
            <p className="text-sm text-ink-500">
              {visible.length} of {products.length} pieces
            </p>
          </div>

          {/* Filter chips — sections first, then categories */}
          {sections.length > 0 && (
            <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1 mb-3">
              <span className="text-xs uppercase tracking-wide font-semibold text-ink-500 self-center mr-1 shrink-0">
                Section
              </span>
              {[{ slug: "all", name: "All" }, ...sections].map((s) => (
                <button
                  key={s.slug}
                  onClick={() => setSectionFilter(s.slug)}
                  className="px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap border transition-colors"
                  style={
                    sectionFilter === s.slug
                      ? { background: theme, color: "#fff", borderColor: theme }
                      : {
                          background: "transparent",
                          color: "#374151",
                          borderColor: "#e5e7eb",
                        }
                  }
                >
                  {s.name}
                </button>
              ))}
            </div>
          )}
          {cats.length > 0 && (
            <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1 mb-6">
              <span className="text-xs uppercase tracking-wide font-semibold text-ink-500 self-center mr-1 shrink-0">
                Category
              </span>
              {[{ slug: "all", name: `All (${products.length})` }, ...cats].map(
                (c) => (
                  <button
                    key={c.slug}
                    onClick={() => setCatFilter(c.slug)}
                    className="px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap border transition-colors"
                    style={
                      catFilter === c.slug
                        ? {
                            background: theme,
                            color: "#fff",
                            borderColor: theme,
                          }
                        : {
                            background: "transparent",
                            color: "#374151",
                            borderColor: "#e5e7eb",
                          }
                    }
                  >
                    {c.name}
                  </button>
                ),
              )}
            </div>
          )}

          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-5">
              {Array.from({ length: 8 }).map((_, i) => (
                <div
                  key={i}
                  className="h-64 bg-surface border border-line rounded-xl animate-pulse"
                />
              ))}
            </div>
          ) : visible.length === 0 ? (
            <div className="py-16 text-center border border-dashed border-line rounded-xl bg-canvas/40">
              <p className="font-semibold text-ink-900">
                Nothing matches this filter
              </p>
              <p className="text-sm text-ink-700 mt-1 mb-4">
                Try a different section or category.
              </p>
              <button
                onClick={() => {
                  setCatFilter("all");
                  setSectionFilter("all");
                }}
                className="btn-secondary text-sm"
              >
                Clear filters
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-5">
              {visible.map((p) => (
                <ProductCard
                  key={p.id}
                  product={p}
                  vendorId={storeKey}
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
      </section>
    </>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-ink-500">{label}</dt>
      <dd className="font-semibold text-ink-900 text-right">{value}</dd>
    </div>
  );
}

// ── BANNER SLIDER ──────────────────────────────────────────────────────────────
function BannerSlider({
  bannerUrls,
  theme,
}: {
  bannerUrls: string[];
  theme: string;
}) {
  const [current, setCurrent] = useState(0);
  const [paused, setPaused] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const slides = bannerUrls.length > 0 ? bannerUrls : [];
  const hasSlides = slides.length > 0;

  const next = useCallback(
    () => setCurrent((c) => (c + 1) % Math.max(slides.length, 1)),
    [slides.length],
  );
  const prev = useCallback(
    () =>
      setCurrent(
        (c) =>
          (c - 1 + Math.max(slides.length, 1)) % Math.max(slides.length, 1),
      ),
    [slides.length],
  );

  useEffect(() => {
    if (!hasSlides || slides.length < 2 || paused) return;
    timerRef.current = setInterval(next, 4500);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [hasSlides, slides.length, paused, next]);

  return (
    <div
      className="relative w-full overflow-hidden select-none"
      style={{ height: "min(75vh, 680px)" }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {hasSlides ? (
        slides.map((url, idx) => (
          <div
            key={url}
            className="absolute inset-0 transition-opacity duration-700"
            style={{
              opacity: idx === current ? 1 : 0,
              zIndex: idx === current ? 1 : 0,
            }}
          >
            <img src={url} alt="" className="w-full h-full object-cover" />
            <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/25 to-transparent" />
          </div>
        ))
      ) : (
        <div
          className="absolute inset-0"
          style={{
            background: `linear-gradient(160deg, ${theme}cc 0%, ${theme}44 60%, #0002 100%)`,
          }}
        />
      )}

      {slides.length > 1 && (
        <>
          <button
            onClick={prev}
            className="absolute left-4 top-1/2 -translate-y-1/2 z-20 h-10 w-10 rounded-full bg-black/20 hover:bg-black/45 text-white flex items-center justify-center backdrop-blur-md border border-white/20 transition-all duration-200"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m15 18-6-6 6-6" />
            </svg>
          </button>
          <button
            onClick={next}
            className="absolute right-4 top-1/2 -translate-y-1/2 z-20 h-10 w-10 rounded-full bg-black/20 hover:bg-black/45 text-white flex items-center justify-center backdrop-blur-md border border-white/20 transition-all duration-200"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m9 18 6-6-6-6" />
            </svg>
          </button>
          <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5">
            {slides.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrent(idx)}
                className="rounded-full transition-all duration-300"
                style={{
                  width: idx === current ? "28px" : "6px",
                  height: "6px",
                  background:
                    idx === current ? "#fff" : "rgba(255,255,255,0.45)",
                }}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function ProductCard({
  product,
  vendorId,
  theme,
  onAddToCart,
}: {
  product: Product;
  vendorId: string;
  theme: string;
  onAddToCart: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const outOfStock = product.stockQuantity === 0;
  const href = `/store/${vendorId}/products/${product.slug || product.id}`;
  const { code } = useCurrency();

  return (
    <div
      className="group bg-surface border border-line rounded-xl overflow-hidden hover:shadow-lg transition-shadow"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <Link
        href={href}
        className="block relative aspect-square overflow-hidden bg-canvas"
      >
        {product.images[0] ? (
          <img
            src={
              hovered && product.images[1]
                ? product.images[1]
                : product.images[0]
            }
            alt={product.name}
            className="w-full h-full object-cover transition-all duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-ink-400 text-sm">
            No image
          </div>
        )}
        {outOfStock && (
          <div className="absolute inset-0 bg-white/70 flex items-center justify-center">
            <span className="text-xs font-bold text-ink-700 bg-white border border-line px-2 py-1 rounded-full">
              Out of stock
            </span>
          </div>
        )}
      </Link>
      <div className="p-3">
        <p className="text-xs text-ink-500 mb-0.5">{product.category.name}</p>
        <Link
          href={href}
          className="block font-semibold text-ink-900 text-sm line-clamp-2 hover:underline leading-snug"
        >
          {product.name}
        </Link>
        <div className="mt-2 flex items-center justify-between gap-2">
          <span className="font-bold text-ink-900">
            {formatPrice(product.price, code)}
          </span>
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
