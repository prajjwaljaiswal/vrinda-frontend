'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';
import { PageHeader, Card } from '@/components/dashboard/DashboardShell';

export default function VendorOnboardPage() {
  const router = useRouter();
  const [form, setForm] = useState({ shopName: '', description: '', address: '' });
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr('');
    setLoading(true);
    try {
      await api('/api/vendors/onboard', { method: 'POST', body: JSON.stringify(form) });
      toast.success('Shop submitted for review');
      router.push('/vendor');
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Set up your shop"
        subtitle="Tell us about your brand. Your shop will be reviewed by our team before going live."
      />
      <div className="grid lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 p-6">
          <form onSubmit={onSubmit} className="space-y-5">
            <div>
              <label className="block text-xs uppercase tracking-wide font-semibold text-ink-700 mb-1.5">Shop name</label>
              <input
                className="input-field"
                placeholder="e.g. Aanya Fine Jewelry"
                value={form.shopName}
                onChange={(e) => setForm({ ...form, shopName: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="block text-xs uppercase tracking-wide font-semibold text-ink-700 mb-1.5">About your shop</label>
              <textarea
                className="input-field h-32 py-3"
                placeholder="Share your craft, materials, and what makes your pieces special."
                rows={4}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs uppercase tracking-wide font-semibold text-ink-700 mb-1.5">Business address</label>
              <textarea
                className="input-field h-24 py-3"
                placeholder="Used for KYC and shipping returns."
                rows={3}
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
              />
            </div>
            {err && (
              <div className="rounded-md bg-red-50 border border-red-100 text-danger text-sm p-3">{err}</div>
            )}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-line">
              <button type="button" onClick={() => router.back()} className="btn-secondary">Cancel</button>
              <button disabled={loading} className="btn-primary">
                {loading ? 'Submitting…' : 'Submit for review'}
              </button>
            </div>
          </form>
        </Card>

        <Card className="p-6 h-fit">
          <h3 className="font-semibold text-ink-900 mb-3">What happens next?</h3>
          <ol className="space-y-3 text-sm text-ink-700">
            {[
              'We review your shop within 24–48 hours.',
              'Once approved, you can publish listings.',
              'Earnings deposit weekly, minus a 10% platform fee.',
            ].map((s, i) => (
              <li key={i} className="flex gap-3">
                <span className="h-6 w-6 shrink-0 rounded-full bg-brand-50 text-brand-700 text-xs font-bold flex items-center justify-center">
                  {i + 1}
                </span>
                <span>{s}</span>
              </li>
            ))}
          </ol>
        </Card>
      </div>
    </div>
  );
}
