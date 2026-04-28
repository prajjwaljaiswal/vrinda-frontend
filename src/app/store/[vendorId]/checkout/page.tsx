'use client';
import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { useCart } from '@/lib/cart';
import { api } from '@/lib/api';
import { useVendor } from '@/lib/vendor-context';

declare global {
  interface Window { Razorpay: any; }
}

type VendorPaymentMethod = {
  id: string;
  provider: 'RAZORPAY' | 'UPI_MANUAL' | 'BANK_TRANSFER' | 'COD';
  label: string;
  isDefault: boolean;
  publicConfig: any;
};

interface QuoteOption {
  methodId: string;
  carrier: string;
  serviceCode: string | null;
  name: string;
  amount: number;
  etaMinDays: number;
  etaMaxDays: number;
  rateMode: 'FLAT' | 'LIVE';
}
interface QuoteGroup {
  vendorId: string;
  itemCount: number;
  subtotal: number;
  options: QuoteOption[];
  warnings?: string[];
}

const PLATFORM_RAZORPAY: VendorPaymentMethod = {
  id: '__platform_razorpay__',
  provider: 'RAZORPAY',
  label: 'Pay online',
  isDefault: true,
  publicConfig: null,
};
const PLATFORM_COD: VendorPaymentMethod = {
  id: '__platform_cod__',
  provider: 'COD',
  label: 'Cash on Delivery',
  isDefault: false,
  publicConfig: null,
};

function methodSubtitle(m: VendorPaymentMethod): string {
  switch (m.provider) {
    case 'RAZORPAY':      return 'UPI, cards, netbanking via Razorpay';
    case 'UPI_MANUAL':    return m.publicConfig?.vpa ? `Pay to ${m.publicConfig.vpa}` : 'Pay via UPI directly to the shop';
    case 'BANK_TRANSFER': return m.publicConfig?.bankName
      ? `Bank transfer · ${m.publicConfig.bankName} ••${m.publicConfig.accountLast4 ?? ''}`
      : 'Direct bank transfer';
    case 'COD':           return 'Pay when your order arrives';
  }
}

export default function VendorCheckoutPage() {
  const router = useRouter();
  const { vendor, theme } = useVendor();
  const { items, setQty, remove, clear } = useCart();
  const [addr, setAddr] = useState({ name: '', line1: '', line2: '', city: '', state: '', pincode: '', phone: '' });
  const [methods, setMethods] = useState<VendorPaymentMethod[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const [codEnabled, setCodEnabled] = useState(false);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);
  const [paymentInstructions, setPaymentInstructions] = useState<any>(null);

  // Filter cart to only current vendor's items
  const vendorItems = useMemo(
    () => items.filter((i) => !i.vendorId || i.vendorId === vendor.id),
    [items, vendor.id]
  );
  const otherItems = useMemo(
    () => items.filter((i) => i.vendorId && i.vendorId !== vendor.id),
    [items, vendor.id]
  );

  const [shipQuote, setShipQuote] = useState<QuoteGroup[] | null>(null);
  const [shipLoading, setShipLoading] = useState(false);
  const [shipError, setShipError] = useState('');
  const [shipSel, setShipSel] = useState<Record<string, { methodId: string; serviceCode: string | null }>>({});

  const subtotal = vendorItems.reduce((s, i) => s + i.price * i.quantity, 0);
  const shipping = shipQuote
    ? shipQuote.reduce((sum, g) => {
        const sel = shipSel[g.vendorId];
        const opt = sel ? g.options.find((o) => o.methodId === sel.methodId && o.serviceCode === sel.serviceCode) : null;
        return sum + (opt?.amount ?? 0);
      }, 0)
    : 0;
  const allVendorsCovered = shipQuote
    ? shipQuote.every((g) => g.options.length === 0 || !!shipSel[g.vendorId])
    : false;
  const grand = subtotal + shipping;

  function selectionsPayload() {
    return Object.entries(shipSel).map(([vendorId, s]) => ({
      vendorId, methodId: s.methodId, serviceCode: s.serviceCode,
    }));
  }

  useEffect(() => {
    api<{ enabled: boolean }>('/api/settings/cod', { auth: false })
      .then((r) => setCodEnabled(r.enabled))
      .catch(() => {});
  }, []);

  // Load this vendor's configured payment methods (active only). If none, fall back
  // to the platform defaults so checkout still works.
  useEffect(() => {
    api<VendorPaymentMethod[]>(`/api/payments/public/vendors/${vendor.id}/methods`, { auth: false, silent: true })
      .then((rows) => {
        const list = rows && rows.length > 0 ? rows : [PLATFORM_RAZORPAY, ...(codEnabled ? [PLATFORM_COD] : [])];
        setMethods(list);
        const def = list.find((m) => m.isDefault) ?? list[0];
        if (def) setSelectedId(def.id);
      })
      .catch(() => {
        const list = [PLATFORM_RAZORPAY, ...(codEnabled ? [PLATFORM_COD] : [])];
        setMethods(list);
        setSelectedId(list[0].id);
      });
  }, [vendor.id, codEnabled]);

  const selectedMethod = methods.find((m) => m.id === selectedId) ?? null;

  // Fetch shipping quote when destination is filled in
  useEffect(() => {
    if (vendorItems.length === 0) { setShipQuote(null); return; }
    const pinOk = /^\d{6}$/.test(addr.pincode);
    const stateOk = addr.state.trim().length >= 2;
    if (!pinOk || !stateOk) { setShipQuote(null); return; }

    const ctrl = new AbortController();
    setShipLoading(true);
    setShipError('');
    const isCOD = !!selectedMethod && selectedMethod.provider === 'COD';
    api<{ groups: QuoteGroup[] }>('/api/shipping/quote', {
      method: 'POST',
      auth: false,
      silent: true,
      signal: ctrl.signal,
      body: JSON.stringify({
        items: vendorItems.map((i) => ({ productId: i.productId, quantity: i.quantity, variationComboId: i.variationComboId })),
        destination: { postalCode: addr.pincode, state: addr.state, country: 'IN' },
        paymentMode: isCOD ? 'COD' : 'PREPAID',
      }),
    } as any)
      .then((res) => {
        setShipQuote(res.groups);
        setShipSel((prev) => {
          const next = { ...prev };
          for (const g of res.groups) {
            const stillValid = next[g.vendorId] && g.options.find(
              (o) => o.methodId === next[g.vendorId].methodId && o.serviceCode === next[g.vendorId].serviceCode,
            );
            if (!stillValid && g.options.length > 0) {
              const cheapest = g.options[0];
              next[g.vendorId] = { methodId: cheapest.methodId, serviceCode: cheapest.serviceCode };
            }
          }
          return next;
        });
      })
      .catch((e: any) => {
        if (e?.name !== 'AbortError') setShipError(e?.message || 'Failed to load shipping options');
      })
      .finally(() => setShipLoading(false));

    return () => ctrl.abort();
  }, [vendorItems, addr.pincode, addr.state, selectedMethod?.provider]);

  function loadRazorpayScript(): Promise<boolean> {
    return new Promise((resolve) => {
      if (window.Razorpay) return resolve(true);
      const s = document.createElement('script');
      s.src = 'https://checkout.razorpay.com/v1/checkout.js';
      s.onload = () => resolve(true);
      s.onerror = () => resolve(false);
      document.body.appendChild(s);
    });
  }

  function clearVendorItems() {
    vendorItems.forEach((i) => remove(i.productId, i.variationComboId));
  }

  function validateAddr(): string[] {
    const missing: string[] = [];
    if (addr.name.trim().length < 2)   missing.push('Full name');
    if (addr.line1.trim().length < 2)  missing.push('Address line 1');
    if (addr.city.trim().length < 2)   missing.push('City');
    if (addr.state.trim().length < 2)  missing.push('State');
    if (!/^\d{6}$/.test(addr.pincode)) missing.push('Pincode (6 digits)');
    if (addr.phone.trim().length < 10) missing.push('Phone (10 digits)');
    return missing;
  }

  async function placeOffGateway() {
    setErr('');
    const missing = validateAddr();
    if (missing.length > 0) { setErr(`Please fill in: ${missing.join(', ')}`); return; }
    if (!selectedMethod) { setErr('Select a payment method'); return; }
    if (!allVendorsCovered) { setErr('Select a shipping option'); return; }

    setLoading(true);
    try {
      const isPlatform = selectedMethod.id.startsWith('__platform_');
      const res = await api<{ orderId: string; paymentInstructions?: any }>('/api/orders/cod', {
        method: 'POST',
        body: JSON.stringify({
          items: vendorItems.map((i) => ({ productId: i.productId, quantity: i.quantity, variationComboId: i.variationComboId })),
          shippingAddress: addr,
          shippingSelections: selectionsPayload(),
          ...(isPlatform ? {} : { paymentMethodId: selectedMethod.id }),
        }),
      });

      // For UPI/bank, show the payout instructions before navigating away.
      if (res.paymentInstructions && (selectedMethod.provider === 'UPI_MANUAL' || selectedMethod.provider === 'BANK_TRANSFER')) {
        setPaymentInstructions({ provider: selectedMethod.provider, data: res.paymentInstructions, orderId: res.orderId });
        clearVendorItems();
        setLoading(false);
        return;
      }

      toast.success('Order placed!');
      clearVendorItems();
      router.push(`/store/${vendor.id}/orders`);
    } catch (e: any) {
      setErr(e.message);
      setLoading(false);
    }
  }

  async function payOnline() {
    setErr('');
    const missing = validateAddr();
    if (missing.length > 0) { setErr(`Please fill in: ${missing.join(', ')}`); return; }
    if (!selectedMethod) { setErr('Select a payment method'); return; }
    if (!allVendorsCovered) { setErr('Select a shipping option'); return; }

    setLoading(true);
    try {
      const ok = await loadRazorpayScript();
      if (!ok) throw new Error('Failed to load payment gateway');

      const isPlatform = selectedMethod.id.startsWith('__platform_');
      const checkout = await api<{
        orderId: string;
        razorpayOrderId: string;
        amount: number;
        currency: string;
        razorpayKeyId: string;
      }>('/api/orders/checkout', {
        method: 'POST',
        body: JSON.stringify({
          items: vendorItems.map((i) => ({ productId: i.productId, quantity: i.quantity, variationComboId: i.variationComboId })),
          shippingAddress: addr,
          shippingSelections: selectionsPayload(),
          ...(isPlatform ? {} : { paymentMethodId: selectedMethod.id }),
        }),
      });

      const rzp = new window.Razorpay({
        key: checkout.razorpayKeyId,
        amount: checkout.amount,
        currency: checkout.currency,
        order_id: checkout.razorpayOrderId,
        name: vendor.shopName,
        prefill: { name: addr.name, contact: addr.phone },
        handler: async (response: any) => {
          try {
            await api('/api/orders/verify-payment', {
              method: 'POST',
              body: JSON.stringify({
                orderId: checkout.orderId,
                razorpayOrderId: response.razorpay_order_id,
                razorpayPaymentId: response.razorpay_payment_id,
                razorpaySignature: response.razorpay_signature,
              }),
            });
            toast.success('Payment successful — order confirmed!');
            clearVendorItems();
            router.push(`/store/${vendor.id}/orders`);
          } catch (e: any) {
            setErr(`Payment verification failed: ${e.message}`);
          }
        },
        modal: { ondismiss: () => setLoading(false) },
        theme: { color: theme },
      });
      rzp.open();
    } catch (e: any) {
      setErr(e.message);
      setLoading(false);
    }
  }

  function handlePlace() {
    if (!selectedMethod) { setErr('Select a payment method'); return; }
    if (selectedMethod.provider === 'RAZORPAY') payOnline();
    else placeOffGateway();
  }

  if (vendorItems.length === 0) {
    return (
      <div className="max-w-6xl mx-auto px-6 py-16">
        <div className="max-w-md mx-auto text-center bg-surface border border-line rounded-md shadow-card p-10">
          <div
            className="inline-flex h-14 w-14 rounded-full items-center justify-center mb-4 text-white"
            style={{ background: theme }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="9" cy="20" r="1.5" /><circle cx="18" cy="20" r="1.5" />
              <path d="M3 4h2l2.4 11.2a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 2-1.5L21 8H6" />
            </svg>
          </div>
          <h1 className="font-display text-3xl text-ink-900 mb-2">Your cart is empty</h1>
          <p className="text-ink-700 mb-6">Add something from {vendor.shopName} to get started.</p>
          <Link
            href={`/store/${vendor.id}`}
            className="inline-block px-5 py-2.5 rounded-pill text-white font-semibold hover:opacity-90"
            style={{ background: theme }}
          >
            Continue shopping
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <nav className="text-xs text-ink-500 mb-4">
        <Link href={`/store/${vendor.id}`} className="hover:opacity-70" style={{ color: theme }}>{vendor.shopName}</Link>
        <span className="mx-1.5">/</span>
        <span className="text-ink-900">Checkout</span>
      </nav>

      <h1 className="font-display text-3xl text-ink-900 mb-2">Checkout</h1>
      <p className="text-sm text-ink-500 mb-6">Items from <span className="font-semibold" style={{ color: theme }}>{vendor.shopName}</span></p>

      {otherItems.length > 0 && (
        <div className="mb-6 p-3 rounded-md text-sm border" style={{ background: `${theme}10`, borderColor: `${theme}40`, color: theme }}>
          You have {otherItems.length} item{otherItems.length > 1 ? 's' : ''} from another shop in your cart — they'll be checked out separately.
        </div>
      )}

      <div className="grid lg:grid-cols-[1fr_400px] gap-8 items-start">
        <div className="space-y-6">
          {/* Cart */}
          <section className="bg-surface border border-line rounded-md shadow-card overflow-hidden">
            <div className="px-5 py-4 border-b border-line flex items-center justify-between">
              <h2 className="font-semibold text-ink-900">Your cart <span className="text-ink-500 font-normal">· {vendorItems.length} item{vendorItems.length === 1 ? '' : 's'}</span></h2>
              <Link href={`/store/${vendor.id}`} className="text-sm hover:underline" style={{ color: theme }}>Continue shopping</Link>
            </div>
            <ul className="divide-y divide-line">
              {vendorItems.map((i) => (
                <li key={`${i.productId}::${i.variationComboId ?? ''}`} className="p-5 flex gap-4">
                  <div className="h-20 w-20 rounded-md bg-canvas overflow-hidden shrink-0">
                    {i.image && <img src={i.image} alt="" className="w-full h-full object-cover" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-ink-900 line-clamp-2">{i.name}</p>
                    {i.variationLabel && <p className="text-xs text-ink-700 mt-0.5">{i.variationLabel}</p>}
                    <p className="text-xs text-ink-500 mt-0.5">by {i.vendorName}</p>
                    <div className="mt-3 flex items-center gap-3">
                      <div className="inline-flex items-center border border-line rounded-pill overflow-hidden">
                        <button onClick={() => setQty(i.productId, Math.max(1, i.quantity - 1), i.variationComboId)} className="w-8 h-8 hover:bg-canvas text-ink-700">−</button>
                        <span className="w-8 text-center text-sm font-semibold">{i.quantity}</span>
                        <button onClick={() => setQty(i.productId, i.quantity + 1, i.variationComboId)} className="w-8 h-8 hover:bg-canvas text-ink-700">+</button>
                      </div>
                      <button onClick={() => remove(i.productId, i.variationComboId)} className="text-xs text-ink-500 hover:text-red-600 underline underline-offset-4">
                        Remove
                      </button>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-bold text-ink-900">₹{(i.price * i.quantity).toLocaleString('en-IN')}</p>
                    {i.quantity > 1 && (
                      <p className="text-xs text-ink-500 mt-0.5">
                        ₹{i.price.toLocaleString('en-IN')} × {i.quantity}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </section>

          {/* Address */}
          <section className="bg-surface border border-line rounded-md shadow-card">
            <div className="px-5 py-4 border-b border-line">
              <h2 className="font-semibold text-ink-900">Shipping address</h2>
              <p className="text-xs text-ink-500 mt-0.5">We'll use this to deliver your order and send tracking updates.</p>
            </div>
            <div className="p-5 space-y-4">
              <Field label="Full name">
                <input className="input-field" placeholder="As it appears on your ID"
                  value={addr.name} onChange={(e) => setAddr({ ...addr, name: e.target.value })} />
              </Field>
              <Field label="Address line 1">
                <input className="input-field" placeholder="Flat / House no., building, street"
                  value={addr.line1} onChange={(e) => setAddr({ ...addr, line1: e.target.value })} />
              </Field>
              <Field label="Address line 2 (optional)">
                <input className="input-field" placeholder="Area, landmark"
                  value={addr.line2} onChange={(e) => setAddr({ ...addr, line2: e.target.value })} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="City">
                  <input className="input-field"
                    value={addr.city} onChange={(e) => setAddr({ ...addr, city: e.target.value })} />
                </Field>
                <Field label="State">
                  <input className="input-field"
                    value={addr.state} onChange={(e) => setAddr({ ...addr, state: e.target.value })} />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Pincode">
                  <input className="input-field" inputMode="numeric" maxLength={6} placeholder="6 digits"
                    value={addr.pincode} onChange={(e) => setAddr({ ...addr, pincode: e.target.value.replace(/\D/g, '').slice(0, 6) })} />
                </Field>
                <Field label="Phone">
                  <input className="input-field" inputMode="numeric" placeholder="10-digit mobile"
                    value={addr.phone} onChange={(e) => setAddr({ ...addr, phone: e.target.value })} />
                </Field>
              </div>
            </div>
          </section>

          {/* Shipping */}
          <section className="bg-surface border border-line rounded-md shadow-card">
            <div className="px-5 py-4 border-b border-line">
              <h2 className="font-semibold text-ink-900">Shipping</h2>
              <p className="text-xs text-ink-500 mt-0.5">Pick a delivery option. Rates load after you fill in pincode and state above.</p>
            </div>
            <div className="p-5 space-y-4">
              {!/^\d{6}$/.test(addr.pincode) || addr.state.trim().length < 2 ? (
                <p className="text-sm text-ink-500">Enter your pincode and state to see shipping options.</p>
              ) : shipLoading ? (
                <p className="text-sm text-ink-500">Loading shipping options…</p>
              ) : shipError ? (
                <p className="text-sm" style={{ color: '#dc2626' }}>{shipError}</p>
              ) : !shipQuote || shipQuote.length === 0 ? (
                <p className="text-sm text-ink-500">No shipping options available.</p>
              ) : (
                <div className="space-y-3">
                  {shipQuote.map((g) => {
                    if (g.options.length === 0) {
                      return (
                        <p key={g.vendorId} className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
                          This shop has no shipping methods to your area. Please contact them.
                        </p>
                      );
                    }
                    const sel = shipSel[g.vendorId];
                    return (
                      <div key={g.vendorId} className="space-y-2">
                        {g.options.map((o) => {
                          const id = `${g.vendorId}-${o.methodId}-${o.serviceCode ?? 'na'}`;
                          const checked = !!sel && sel.methodId === o.methodId && sel.serviceCode === o.serviceCode;
                          return (
                            <label
                              key={id}
                              htmlFor={id}
                              className="flex items-center gap-3 p-3 rounded-md border cursor-pointer transition-colors"
                              style={checked
                                ? { borderColor: theme, background: `${theme}10` }
                                : { borderColor: '#e5e7eb', background: '#fff' }}
                            >
                              <input
                                id={id}
                                type="radio"
                                name={`ship-${g.vendorId}`}
                                checked={checked}
                                onChange={() => setShipSel((p) => ({ ...p, [g.vendorId]: { methodId: o.methodId, serviceCode: o.serviceCode } }))}
                                style={{ accentColor: theme }}
                              />
                              <div className="flex-1">
                                <p className="text-sm font-semibold" style={{ color: checked ? theme : '#111827' }}>
                                  {o.name}
                                  {o.rateMode === 'LIVE' && <span className="ml-2 text-[10px] uppercase tracking-wide text-ink-500">live</span>}
                                </p>
                                <p className="text-xs text-ink-500">
                                  {o.carrier} · {o.etaMinDays}–{o.etaMaxDays} days
                                </p>
                              </div>
                              <p className="text-sm font-semibold text-ink-900">
                                {o.amount === 0 ? <span style={{ color: '#059669' }}>Free</span> : `₹${o.amount.toLocaleString('en-IN')}`}
                              </p>
                            </label>
                          );
                        })}
                        {g.warnings?.map((w) => (
                          <p key={w} className="text-xs text-amber-700">{w}</p>
                        ))}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </section>

          {/* Payment method */}
          <section className="bg-surface border border-line rounded-md shadow-card">
            <div className="px-5 py-4 border-b border-line">
              <h2 className="font-semibold text-ink-900">Payment method</h2>
            </div>
            <div className="p-5 space-y-3">
              {methods.length === 0 ? (
                <p className="text-sm text-ink-500">Loading payment options…</p>
              ) : (
                methods.map((m) => (
                  <PayOption
                    key={m.id}
                    id={`pay-${m.id}`}
                    selected={selectedId === m.id}
                    onSelect={() => setSelectedId(m.id)}
                    theme={theme}
                    icon={<ProviderIcon provider={m.provider} />}
                    title={m.label}
                    subtitle={methodSubtitle(m)}
                  />
                ))
              )}
            </div>
          </section>
        </div>

        {/* Order summary */}
        <aside className="lg:sticky lg:top-32 self-start space-y-4">
          <div className="bg-surface border border-line rounded-md shadow-card overflow-hidden">
            <div className="px-5 py-4 border-b border-line">
              <h2 className="font-semibold text-ink-900">Order summary</h2>
            </div>
            <div className="p-5 space-y-3">
              <Row label="Subtotal" value={`₹${subtotal.toLocaleString('en-IN')}`} />
              <Row
                label="Shipping"
                value={
                  shipLoading
                    ? '…'
                    : !shipQuote
                      ? 'Enter pincode'
                      : shipping === 0 && allVendorsCovered
                        ? 'Free'
                        : `₹${shipping.toLocaleString('en-IN')}`
                }
                valueColor={shipping === 0 && allVendorsCovered ? '#059669' : undefined}
              />
              <Row label="Estimated taxes" value="Included" muted />
              <div className="border-t border-line pt-3 flex items-baseline justify-between">
                <span className="text-sm font-semibold text-ink-900">Total</span>
                <div className="text-right">
                  <p className="text-2xl font-bold text-ink-900">₹{grand.toLocaleString('en-IN')}</p>
                  <p className="text-xs text-ink-500">incl. of all taxes</p>
                </div>
              </div>

              {err && (
                <div className="rounded-md bg-red-50 border border-red-100 text-sm p-3" style={{ color: '#dc2626' }}>{err}</div>
              )}

              <button
                onClick={handlePlace}
                disabled={loading}
                className="w-full py-3.5 rounded-pill text-white font-semibold text-base transition-opacity hover:opacity-90 disabled:opacity-60"
                style={{ background: theme }}
              >
                {loading
                  ? 'Processing…'
                  : selectedMethod?.provider === 'RAZORPAY'
                    ? `Pay ₹${grand.toLocaleString('en-IN')}`
                    : `Place order · ₹${grand.toLocaleString('en-IN')}`}
              </button>

              <p className="text-[11px] text-ink-500 text-center pt-1">
                {selectedMethod ? methodSubtitle(selectedMethod) : ''}
              </p>
            </div>
          </div>

          <ul className="space-y-2 px-1">
            {[
              'Free 30-day returns',
              'Hallmarked & certified',
              'Tracked shipping across India',
            ].map((t) => (
              <li key={t} className="flex items-center gap-2 text-xs text-ink-700">
                <span style={{ color: theme }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 4 4L19 6" /></svg>
                </span>
                {t}
              </li>
            ))}
          </ul>
        </aside>
      </div>

      {paymentInstructions && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => router.push(`/store/${vendor.id}/orders`)}>
          <div className="bg-surface max-w-md w-full rounded-md shadow-xl p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-display text-xl text-ink-900 mb-1">Order placed</h3>
            <p className="text-sm text-ink-700 mb-4">
              Complete payment using the details below. Your order will be confirmed once {vendor.shopName} verifies receipt.
            </p>
            <div className="bg-canvas border border-line rounded-md p-4 text-sm space-y-2">
              {paymentInstructions.provider === 'UPI_MANUAL' && (
                <>
                  <Row label="Pay to UPI" value={paymentInstructions.data.vpa} />
                  <Row label="Name" value={paymentInstructions.data.displayName} />
                  <Row label="Amount" value={`₹${grand.toLocaleString('en-IN')}`} />
                  <Row label="Reference" value={paymentInstructions.orderId.slice(0, 8).toUpperCase()} />
                </>
              )}
              {paymentInstructions.provider === 'BANK_TRANSFER' && (
                <>
                  <Row label="Account holder" value={paymentInstructions.data.accountHolder} />
                  {paymentInstructions.data.bankName && <Row label="Bank" value={paymentInstructions.data.bankName} />}
                  {paymentInstructions.data.ifsc && <Row label="IFSC" value={paymentInstructions.data.ifsc} />}
                  <Row label="Account ending" value={`••${paymentInstructions.data.accountLast4}`} />
                  <Row label="Amount" value={`₹${grand.toLocaleString('en-IN')}`} />
                  <Row label="Reference" value={paymentInstructions.orderId.slice(0, 8).toUpperCase()} />
                </>
              )}
            </div>
            <button
              onClick={() => router.push(`/store/${vendor.id}/orders`)}
              className="mt-5 w-full py-3 rounded-pill text-white font-semibold"
              style={{ background: theme }}
            >
              I&apos;ve sent the payment
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ProviderIcon({ provider }: { provider: VendorPaymentMethod['provider'] }) {
  const common = { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  switch (provider) {
    case 'RAZORPAY':
      return <svg {...common}><rect x="1" y="4" width="22" height="16" rx="2" ry="2" /><line x1="1" y1="10" x2="23" y2="10" /></svg>;
    case 'UPI_MANUAL':
      return <svg {...common}><path d="M3 12h18" /><path d="M12 3v18" /><circle cx="12" cy="12" r="9" /></svg>;
    case 'BANK_TRANSFER':
      return <svg {...common}><path d="M3 9 12 3l9 6" /><path d="M5 9v10" /><path d="M19 9v10" /><path d="M3 21h18" /></svg>;
    case 'COD':
      return <svg {...common}><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg>;
  }
}

function PayOption({
  id, selected, onSelect, icon, title, subtitle, theme,
}: {
  id: string;
  selected: boolean;
  onSelect: () => void;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  theme: string;
}) {
  return (
    <label
      htmlFor={id}
      className="flex items-center gap-4 p-4 rounded-md border cursor-pointer transition-colors"
      style={selected
        ? { borderColor: theme, background: `${theme}10` }
        : { borderColor: '#e5e7eb', background: '#fff' }}
    >
      <input
        id={id}
        type="radio"
        name="payMethod"
        checked={selected}
        onChange={onSelect}
        style={{ accentColor: theme }}
      />
      <span style={{ color: selected ? theme : '#6b7280' }}>{icon}</span>
      <div className="flex-1">
        <p className="text-sm font-semibold" style={{ color: selected ? theme : '#111827' }}>{title}</p>
        <p className="text-xs text-ink-500">{subtitle}</p>
      </div>
    </label>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs uppercase tracking-wide font-semibold text-ink-700 mb-1.5">{label}</span>
      {children}
    </label>
  );
}

function Row({ label, value, muted, valueColor }: { label: string; value: string; muted?: boolean; valueColor?: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className={muted ? 'text-ink-500' : 'text-ink-700'}>{label}</span>
      <span className="font-medium" style={{ color: valueColor ?? '#111827' }}>{value}</span>
    </div>
  );
}
