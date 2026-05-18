'use client';
import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';
import { PageHeader, Card, StatusPill } from '@/components/dashboard/DashboardShell';
import { useCurrency, formatPrice } from '@/lib/currency';

interface OrderItem {
  id: string;
  quantity: number;
  priceAtPurchase: string;
  status: string;
  shippingMethodId: string | null;
  shippingCarrier: string | null;
  shippingService: string | null;
  shippingCost: string | null;
  trackingNumber: string | null;
  trackingUrl: string | null;
  labelUrl: string | null;
  product: { name: string; images: string[] };
  order: {
    id: string;
    createdAt: string;
    paymentMethod: string;
    shippingAddress: any;
    customer: { name: string; email: string; phone: string | null };
  };
}

const TABS = [
  { id: 'TO_SHIP', label: 'To ship' },
  { id: 'SHIPPED', label: 'Shipped' },
  { id: 'DELIVERED', label: 'Delivered' },
  { id: 'CANCELLED', label: 'Cancelled' },
] as const;

const STATUS_NEXT: Record<string, { label: string; value: string; style: string } | null> = {
  PENDING: { label: 'Mark shipped', value: 'SHIPPED', style: 'btn-primary' },
  PAID:    { label: 'Mark shipped', value: 'SHIPPED', style: 'btn-primary' },
  SHIPPED: { label: 'Mark delivered', value: 'DELIVERED', style: 'btn-secondary' },
  DELIVERED: null,
  CANCELLED: null,
};

function statusTone(s: string): 'success' | 'info' | 'danger' | 'warn' {
  if (s === 'DELIVERED') return 'success';
  if (s === 'SHIPPED')   return 'info';
  if (s === 'CANCELLED') return 'danger';
  return 'warn';
}

function statusLabel(s: string) {
  return s === 'PENDING' ? 'COD PENDING' : s;
}

export default function VendorOrdersPage() {
  const { code } = useCurrency();
  const [items, setItems]     = useState<OrderItem[]>([]);
  const [tab, setTab]         = useState<typeof TABS[number]['id']>('TO_SHIP');
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<OrderItem | null>(null);
  const [updating, setUpdating] = useState(false);
  const [updateErr, setUpdateErr] = useState('');

  async function load() {
    setLoading(true);
    try {
      const data = await api<OrderItem[]>('/api/vendors/me/orders');
      setItems(data);
      // keep selected in sync after reload
      if (selected) {
        const fresh = data.find((i) => i.id === selected.id);
        setSelected(fresh ?? null);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function updateStatus(itemId: string, status: string) {
    setUpdating(true);
    setUpdateErr('');
    try {
      await api(`/api/orders/items/${itemId}/status`, { method: 'PATCH', body: JSON.stringify({ status }) });
      toast.success(`Order marked as ${status.toLowerCase()}`);
      await load();
    } catch (e: any) {
      setUpdateErr(e.message);
    } finally {
      setUpdating(false);
    }
  }

  async function createShipment(itemId: string, manual = false) {
    setUpdating(true);
    setUpdateErr('');
    try {
      const body = manual ? { manual: true } : {};
      const result = await api<OrderItem>(`/api/shipping/orders/items/${itemId}/ship`, {
        method: 'POST',
        body: JSON.stringify(body),
      });
      toast.success(result.trackingNumber ? `Shipment created · AWB ${result.trackingNumber}` : 'Marked shipped');
      await load();
    } catch (e: any) {
      setUpdateErr(e.message);
    } finally {
      setUpdating(false);
    }
  }

  const counts = useMemo(() => {
    const c: Record<string, number> = { TO_SHIP: 0, SHIPPED: 0, DELIVERED: 0, CANCELLED: 0 };
    items.forEach((i) => {
      if (i.status === 'PAID' || i.status === 'PENDING') c.TO_SHIP += 1;
      else if (c[i.status] !== undefined) c[i.status] += 1;
    });
    return c;
  }, [items]);

  const visible = tab === 'TO_SHIP'
    ? items.filter((i) => i.status === 'PAID' || i.status === 'PENDING')
    : items.filter((i) => i.status === tab);

  const next = selected ? STATUS_NEXT[selected.status] : null;

  return (
    <div>
      <PageHeader title="Orders" subtitle="Manage fulfillment for items sold by your shop." />

      {/* Tabs */}
      <div className="border-b border-line mb-6">
        <div className="flex gap-2 overflow-x-auto no-scrollbar">
          {TABS.map((t) => {
            const active = t.id === tab;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={[
                  'relative px-1 py-3 text-sm whitespace-nowrap transition',
                  active ? 'text-ink-900 font-semibold' : 'text-ink-700 hover:text-ink-900',
                ].join(' ')}
              >
                <span>{t.label}</span>
                <span className={`ml-2 text-[11px] px-1.5 py-0.5 rounded-pill ${active ? 'bg-brand-50 text-brand-700' : 'bg-canvas text-ink-700'}`}>
                  {counts[t.id] || 0}
                </span>
                {active && <span className="absolute left-0 right-0 -bottom-px h-0.5 bg-brand-600 rounded-full" />}
                <span className="mx-3" />
              </button>
            );
          })}
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-24 bg-surface border border-line rounded-md animate-pulse" />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <Card className="p-10 text-center">
          <p className="text-ink-700">No {TABS.find((t) => t.id === tab)?.label.toLowerCase()} orders right now.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {visible.map((it) => {
            const addr = it.order.shippingAddress;
            return (
              <button
                key={it.id}
                onClick={() => { setSelected(it); setUpdateErr(''); }}
                className="w-full text-left"
              >
                <Card className="p-4 flex gap-4 items-center hover:border-brand-300 transition-colors cursor-pointer">
                  <div className="h-20 w-20 rounded-md bg-canvas overflow-hidden shrink-0">
                    {it.product.images[0] && (
                      <img src={it.product.images[0]} alt="" className="w-full h-full object-cover" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-ink-900 truncate">{it.product.name}</p>
                      {it.order.paymentMethod === 'COD' && (
                        <span className="text-[10px] font-bold uppercase tracking-wide bg-amber-100 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded-full shrink-0">COD</span>
                      )}
                    </div>
                    <p className="text-sm text-ink-700">
                      Qty {it.quantity} · {formatPrice(it.priceAtPurchase, code)}
                    </p>
                    <p className="text-xs text-ink-500 mt-1">
                      {it.order.customer.name} · {it.order.customer.phone || it.order.customer.email}
                    </p>
                    {addr && (
                      <p className="text-xs text-ink-500 truncate">
                        {addr.line1}, {addr.city} – {addr.pincode}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <StatusPill tone={statusTone(it.status)}>
                      {statusLabel(it.status)}
                    </StatusPill>
                    <span className="text-xs text-brand-700 hover:underline">View details →</span>
                  </div>
                </Card>
              </button>
            );
          })}
        </div>
      )}

      {/* Detail slide-over */}
      {selected && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/40 z-40"
            onClick={() => setSelected(null)}
          />

          {/* Panel */}
          <div className="fixed inset-y-0 right-0 z-50 w-full max-w-lg bg-surface shadow-2xl flex flex-col overflow-hidden">
            {/* Header */}
            <div className="px-6 py-5 border-b border-line flex items-center justify-between shrink-0">
              <div>
                <p className="text-xs text-ink-500 uppercase tracking-wide font-semibold">Order detail</p>
                <p className="font-mono text-sm text-ink-900 mt-0.5">#{selected.order.id.slice(-8).toUpperCase()}</p>
              </div>
              <button
                onClick={() => setSelected(null)}
                className="h-8 w-8 rounded-md hover:bg-canvas flex items-center justify-center text-ink-700"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Product */}
              <section>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-500 mb-3">Item</h3>
                <div className="flex gap-4">
                  <div className="h-20 w-20 rounded-md bg-canvas overflow-hidden shrink-0">
                    {selected.product.images[0] && (
                      <img src={selected.product.images[0]} alt="" className="w-full h-full object-cover" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-ink-900">{selected.product.name}</p>
                    <p className="text-sm text-ink-700 mt-1">
                      Qty: {selected.quantity}
                    </p>
                    <p className="text-sm text-ink-700">
                      Unit price: {formatPrice(selected.priceAtPurchase, code)}
                    </p>
                    <p className="text-sm font-semibold text-ink-900 mt-1">
                      Subtotal: {formatPrice(Number(selected.priceAtPurchase) * selected.quantity, code)}
                    </p>
                  </div>
                </div>
              </section>

              {/* Status + payment */}
              <section>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-500 mb-3">Status</h3>
                <div className="bg-canvas rounded-md border border-line p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-ink-700">Item status</span>
                    <StatusPill tone={statusTone(selected.status)}>
                      {statusLabel(selected.status)}
                    </StatusPill>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-ink-700">Payment</span>
                    <span className={`text-sm font-semibold ${selected.order.paymentMethod === 'COD' ? 'text-amber-600' : 'text-success'}`}>
                      {selected.order.paymentMethod === 'COD' ? 'Cash on Delivery' : 'Paid online'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-ink-700">Order date</span>
                    <span className="text-sm text-ink-900">
                      {new Date(selected.order.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </span>
                  </div>
                </div>
              </section>

              {/* Shipment */}
              <section>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-500 mb-3">Shipment</h3>
                <div className="bg-canvas rounded-md border border-line p-4 space-y-2">
                  {selected.shippingCarrier ? (
                    <DetailRow label="Carrier" value={`${selected.shippingCarrier}${selected.shippingService ? ` · ${selected.shippingService}` : ''}`} />
                  ) : (
                    <p className="text-sm text-ink-500">No shipping method attached.</p>
                  )}
                  {selected.shippingCost != null && Number(selected.shippingCost) > 0 && (
                    <DetailRow label="Charged" value={formatPrice(selected.shippingCost, code)} />
                  )}
                  {selected.trackingNumber && (
                    <DetailRow label="AWB" value={selected.trackingNumber} />
                  )}
                  {selected.trackingUrl && (
                    <div className="flex gap-3 text-sm">
                      <span className="text-ink-500 w-20 shrink-0">Track</span>
                      <a href={selected.trackingUrl} target="_blank" rel="noreferrer" className="text-brand-700 hover:underline break-all">
                        Open tracking page ↗
                      </a>
                    </div>
                  )}
                  {selected.labelUrl && (
                    <div className="flex gap-3 text-sm">
                      <span className="text-ink-500 w-20 shrink-0">Label</span>
                      <a href={selected.labelUrl} target="_blank" rel="noreferrer" className="text-brand-700 hover:underline break-all">
                        Download label PDF ↗
                      </a>
                    </div>
                  )}
                </div>
              </section>

              {/* Customer */}
              <section>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-500 mb-3">Customer</h3>
                <div className="bg-canvas rounded-md border border-line p-4 space-y-2">
                  <DetailRow label="Name" value={selected.order.customer.name} />
                  <DetailRow label="Email" value={selected.order.customer.email} />
                  {selected.order.customer.phone && (
                    <DetailRow label="Phone" value={selected.order.customer.phone} />
                  )}
                </div>
              </section>

              {/* Shipping address */}
              {selected.order.shippingAddress && (
                <section>
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-500 mb-3">Shipping address</h3>
                  <div className="bg-canvas rounded-md border border-line p-4 space-y-2">
                    {(() => {
                      const a = selected.order.shippingAddress;
                      return (
                        <>
                          <DetailRow label="Name" value={a.name} />
                          <DetailRow label="Address" value={[a.line1, a.line2].filter(Boolean).join(', ')} />
                          <DetailRow label="City" value={a.city} />
                          <DetailRow label="State" value={a.state} />
                          <DetailRow label="Pincode" value={a.pincode} />
                          <DetailRow label="Phone" value={a.phone} />
                        </>
                      );
                    })()}
                  </div>
                </section>
              )}
            </div>

            {/* Footer actions */}
            <div className="px-6 py-4 border-t border-line shrink-0 space-y-2">
              {updateErr && (
                <p className="text-sm text-danger">{updateErr}</p>
              )}

              {next && next.value === 'SHIPPED' && selected.shippingMethodId && !selected.trackingNumber ? (
                <div className="space-y-2">
                  <button
                    onClick={() => createShipment(selected.id, false)}
                    disabled={updating}
                    className="btn-primary w-full !py-3"
                  >
                    {updating ? 'Creating shipment…' : `Create shipment with ${selected.shippingCarrier ?? 'carrier'}`}
                  </button>
                  <button
                    onClick={() => createShipment(selected.id, true)}
                    disabled={updating}
                    className="w-full text-sm text-ink-700 hover:underline py-1"
                  >
                    Skip carrier API · mark shipped manually
                  </button>
                </div>
              ) : next ? (
                <button
                  onClick={() => updateStatus(selected.id, next.value)}
                  disabled={updating}
                  className={`${next.style} w-full !py-3`}
                >
                  {updating ? 'Updating…' : next.label}
                </button>
              ) : (
                <div className="py-2 text-center text-sm text-ink-500">
                  No further status updates available.
                </div>
              )}

              {(selected.status === 'PAID' || selected.status === 'PENDING') && (
                <button
                  onClick={() => updateStatus(selected.id, 'CANCELLED')}
                  disabled={updating}
                  className="w-full text-sm text-danger hover:underline py-1"
                >
                  Cancel this item
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-3 text-sm">
      <span className="text-ink-500 w-20 shrink-0">{label}</span>
      <span className="text-ink-900 font-medium break-all">{value}</span>
    </div>
  );
}
