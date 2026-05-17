'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { PageHeader, KpiCard, StatusPill, Card } from '@/components/dashboard/DashboardShell';

interface Vendor { id: string; shopName: string; status: string; kycStatus?: string; kycRejectionNote?: string | null; }
interface Product { id: string; name: string; price: string; stockQuantity: number; isActive: boolean; images: string[]; }
interface DashboardKpis {
  todayRevenue: number;
  last7Revenue: number;
  series: { dateISO: string; revenue: number }[];
  ordersToShip: number;
  activeListings: number;
  lowStockCount: number;
  outOfStockCount: number;
}

function inr(n: number) {
  return `₹${Math.round(n).toLocaleString('en-IN')}`;
}

export default function VendorDashboard() {
  const router = useRouter();
  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [kpis, setKpis] = useState<DashboardKpis | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const v = await api<Vendor>('/api/vendors/me');
        setVendor(v);
        if (v.status === 'APPROVED') {
          const [p, k] = await Promise.all([
            api<Product[]>('/api/products/vendor/mine'),
            api<DashboardKpis>('/api/vendors/me/dashboard').catch(() => null),
          ]);
          setProducts(p);
          setKpis(k);
        }
      } catch (e: any) {
        if (e.message.includes('Vendor profile not created')) router.push('/vendor/onboard');
        else if (e.message.includes('Missing token')) router.push('/auth/login');
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  if (loading) {
    return (
      <div className="grid md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-28 bg-surface border border-line rounded-md animate-pulse" />
        ))}
      </div>
    );
  }
  if (!vendor) return null;

  // KYC takes precedence over shop status for UX clarity.
  if (vendor.kycStatus === 'NOT_SUBMITTED') {
    return (
      <Card className="p-8 text-center">
        <div className="inline-flex h-12 w-12 rounded-full bg-brand-50 text-brand-700 items-center justify-center mb-3">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14"/></svg>
        </div>
        <h2 className="font-display text-2xl text-ink-900">Finish onboarding</h2>
        <p className="text-ink-700 mt-2 max-w-md mx-auto">Complete your shop profile, KYC, and bank details to start selling.</p>
        <div className="mt-5"><Link href="/sell/onboard" className="btn-primary">Resume onboarding</Link></div>
      </Card>
    );
  }
  if (vendor.kycStatus === 'UNDER_REVIEW') {
    return (
      <Card className="p-8 text-center">
        <div className="inline-flex h-12 w-12 rounded-full bg-amber-50 text-warn items-center justify-center mb-3">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>
        </div>
        <h2 className="font-display text-2xl text-ink-900">KYC under review</h2>
        <p className="text-ink-700 mt-2 max-w-md mx-auto">
          Your shop <span className="font-semibold">"{vendor.shopName}"</span> is under review. We'll email you within 24–48 hours.
        </p>
        <div className="mt-5"><StatusPill tone="warn">Under review</StatusPill></div>
      </Card>
    );
  }
  if (vendor.kycStatus === 'REJECTED') {
    return (
      <Card className="p-8 text-center">
        <h2 className="font-display text-2xl text-ink-900 mb-2">KYC rejected</h2>
        <p className="text-ink-700 max-w-md mx-auto">{vendor.kycRejectionNote || 'Please review and resubmit your details.'}</p>
        <div className="mt-4 flex items-center justify-center gap-3">
          <StatusPill tone="danger">Rejected</StatusPill>
          <Link href="/sell/onboard" className="btn-primary">Update & resubmit</Link>
        </div>
      </Card>
    );
  }

  if (vendor.status === 'PENDING') {
    return (
      <Card className="p-8 text-center">
        <div className="inline-flex h-12 w-12 rounded-full bg-amber-50 text-warn items-center justify-center mb-3">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>
        </div>
        <h2 className="font-display text-2xl text-ink-900">Awaiting approval</h2>
        <p className="text-ink-700 mt-2 max-w-md mx-auto">
          Your shop <span className="font-semibold">"{vendor.shopName}"</span> is under review. We'll email you the moment it goes live.
        </p>
        <div className="mt-5">
          <StatusPill tone="warn">Pending review</StatusPill>
        </div>
      </Card>
    );
  }
  if (vendor.status === 'REJECTED' || vendor.status === 'SUSPENDED') {
    return (
      <Card className="p-8 text-center">
        <h2 className="font-display text-2xl text-ink-900 mb-2">Shop {vendor.status.toLowerCase()}</h2>
        <p className="text-ink-700">Please contact support for next steps.</p>
        <div className="mt-4"><StatusPill tone="danger">{vendor.status}</StatusPill></div>
      </Card>
    );
  }

  const activeCount = products.filter((p) => p.isActive).length;
  const lowStock = products.filter((p) => p.stockQuantity > 0 && p.stockQuantity <= 3).length;
  const outOfStock = products.filter((p) => p.stockQuantity === 0).length;

  return (
    <div>
      <PageHeader
        title={vendor.shopName}
        subtitle="Welcome back — here's what's happening with your shop today."
        actions={
          <>
            <Link href="/vendor/orders" className="btn-secondary">View orders</Link>
            <Link href="/vendor/products/new" className="btn-primary">+ Add product</Link>
          </>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <KpiCard
          label="Today's revenue"
          value={kpis ? inr(kpis.todayRevenue) : '₹0'}
          hint={kpis ? `${inr(kpis.last7Revenue)} this week` : 'Updates as orders are paid'}
        />
        <KpiCard
          label="Orders to ship"
          value={kpis?.ordersToShip ?? 0}
          hint="Mark shipped from Orders"
          accent="brand"
        />
        <KpiCard
          label="Active listings"
          value={kpis?.activeListings ?? activeCount}
          hint={`${products.length} total`}
          accent="success"
        />
        <KpiCard
          label="Stock alerts"
          value={(kpis ? (kpis.lowStockCount + kpis.outOfStockCount) : (lowStock + outOfStock))}
          hint={`${kpis?.outOfStockCount ?? outOfStock} out · ${kpis?.lowStockCount ?? lowStock} low`}
          accent="warn"
        />
      </div>

      {kpis && kpis.series.some((s) => s.revenue > 0) && (
        <Card className="p-5 mb-8">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-xs uppercase tracking-wide font-semibold text-ink-700">Revenue · last 7 days</p>
              <p className="text-2xl font-bold text-ink-900 mt-1">{inr(kpis.last7Revenue)}</p>
            </div>
            <Link href="/vendor/analytics" className="text-sm font-semibold text-brand-700 hover:underline">More analytics →</Link>
          </div>
          <Sparkline points={kpis.series.map((s) => s.revenue)} labels={kpis.series.map((s) => s.dateISO.slice(5))} />
        </Card>
      )}

      <Card className="overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-line">
          <h2 className="font-semibold text-ink-900">Your listings</h2>
          <Link href="/vendor/products/new" className="text-sm text-brand-700 hover:underline">+ New listing</Link>
        </div>
        {products.length === 0 ? (
          <div className="p-10 text-center">
            <div className="inline-flex h-14 w-14 rounded-full bg-brand-50 text-brand-700 items-center justify-center mb-3">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14"/></svg>
            </div>
            <p className="font-semibold text-ink-900">Add your first listing</p>
            <p className="text-sm text-ink-700 mt-1 mb-5">Showcase your craft to thousands of jewelry lovers.</p>
            <Link href="/vendor/products/new" className="btn-primary">Add product</Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-canvas text-left text-xs uppercase tracking-wide text-ink-500">
                <tr>
                  <th className="px-5 py-3 font-semibold">Product</th>
                  <th className="px-5 py-3 font-semibold">Price</th>
                  <th className="px-5 py-3 font-semibold">Stock</th>
                  <th className="px-5 py-3 font-semibold">Status</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody>
                {products.map((p) => (
                  <tr key={p.id} className="border-t border-line">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <div className="h-12 w-12 rounded-md bg-canvas overflow-hidden shrink-0">
                          {p.images[0] && <img src={p.images[0]} alt="" className="w-full h-full object-cover" />}
                        </div>
                        <span className="font-medium text-ink-900 line-clamp-1">{p.name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3 font-semibold">₹{Number(p.price).toLocaleString('en-IN')}</td>
                    <td className="px-5 py-3">
                      <span className={p.stockQuantity === 0 ? 'text-danger' : p.stockQuantity <= 3 ? 'text-warn' : 'text-ink-700'}>
                        {p.stockQuantity}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      {p.isActive
                        ? <StatusPill tone="success">Active</StatusPill>
                        : <StatusPill tone="neutral">Hidden</StatusPill>}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <div className="inline-flex items-center gap-3">
                        <Link href={`/vendor/products/${p.id}/edit`} className="text-sm font-semibold text-brand-700 hover:text-brand-800">Edit</Link>
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              const dup = await api<{ id: string }>(`/api/products/${p.id}/duplicate`, { method: 'POST', body: JSON.stringify({}) });
                              router.push(`/vendor/products/${dup.id}/edit`);
                            } catch {}
                          }}
                          className="text-sm text-ink-700 hover:text-brand-700"
                        >
                          Duplicate
                        </button>
                        <Link href={`/products/${p.id}`} className="text-sm text-ink-700 hover:text-brand-700">View ↗</Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

function Sparkline({ points, labels }: { points: number[]; labels: string[] }) {
  const max = Math.max(1, ...points);
  return (
    <div className="flex items-end gap-2 h-24">
      {points.map((v, i) => {
        const h = max > 0 ? Math.max(2, (v / max) * 100) : 2;
        return (
          <div key={i} className="flex-1 flex flex-col items-center gap-1.5" title={`${labels[i]}: ₹${Math.round(v).toLocaleString('en-IN')}`}>
            <span className="block w-full rounded-t bg-brand-600" style={{ height: `${h}%` }} />
            <span className="text-[10px] text-ink-500 font-mono">{labels[i]}</span>
          </div>
        );
      })}
    </div>
  );
}
