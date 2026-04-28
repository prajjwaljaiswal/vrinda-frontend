'use client';
import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { StepHeader, StepProps, Field, ComingSoonBadge } from '../StepShell';
import { WhenMade } from '../types';

interface Category { id: string; name: string; slug: string; description?: string }

const WHEN_MADE: { value: WhenMade; label: string }[] = [
  { value: 'made_to_order',   label: 'Made to order' },
  { value: '2020s',           label: '2020 — 2026' },
  { value: '2010s',           label: '2010 — 2019' },
  { value: '2000s',           label: '2000 — 2009' },
  { value: 'before_2000',     label: 'Before 2000' },
  { value: 'vintage',         label: 'Vintage (20+ years old)' },
];

export function CategoryStep({ draft, setDraft }: StepProps) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [q, setQ] = useState('');

  useEffect(() => {
    api<Category[]>('/api/categories', { auth: false }).then(setCategories).catch(() => {});
  }, []);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return categories.slice(0, 8);
    return categories.filter((c) => c.name.toLowerCase().includes(t)).slice(0, 12);
  }, [categories, q]);

  const selected = categories.find((c) => c.id === draft.categoryId);

  return (
    <>
      <StepHeader
        title="Category"
        subtitle="Pick the closest match — buyers find your item by browsing categories."
      />
      <div className="p-6 space-y-6">
        <Field label="Find a category" required>
          <input
            className="input-field h-12 text-sm"
            placeholder="Examples: Engagement Rings, Choker, Anklet"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </Field>

        {selected && !q && (
          <div className="rounded-md border border-brand-200 bg-brand-50 p-4 flex items-center gap-3">
            <span className="h-8 w-8 rounded-full bg-brand-600 text-white flex items-center justify-center text-xs font-bold">✓</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-ink-900">{selected.name}</p>
              {selected.description && <p className="text-xs text-ink-700 truncate">{selected.description}</p>}
            </div>
            <button type="button" onClick={() => setDraft({ categoryId: '' })}
              className="text-xs font-semibold text-brand-700 hover:text-brand-800">Change</button>
          </div>
        )}

        {(q || !selected) && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-700 mb-2">
              {q ? 'Matches' : 'Or, choose from your top categories'}
            </p>
            <div className="space-y-2">
              {filtered.length === 0 && <p className="text-sm text-ink-500 italic">No matches.</p>}
              {filtered.map((c) => {
                const active = c.id === draft.categoryId;
                return (
                  <button key={c.id} type="button"
                    onClick={() => { setDraft({ categoryId: c.id }); setQ(''); }}
                    className={[
                      'w-full text-left rounded-md border p-3 transition',
                      active
                        ? 'border-brand-600 bg-brand-50 ring-1 ring-brand-600'
                        : 'border-line bg-surface hover:border-ink-300',
                    ].join(' ')}
                  >
                    <p className="text-sm font-semibold text-ink-900">{c.name}</p>
                    {c.description && <p className="text-xs text-ink-500 mt-0.5">{c.description}</p>}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="border-t border-line pt-6">
          <p className="text-sm font-semibold text-ink-900 mb-2">What type of item is it? <span className="text-danger">*</span></p>
          <div className="grid sm:grid-cols-2 gap-3">
            <button type="button"
              className="rounded-md border-2 border-brand-600 ring-1 ring-brand-600 bg-brand-50 p-4 text-left">
              <div className="h-10 w-10 rounded-md bg-white border border-line flex items-center justify-center text-brand-600 mb-2">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 8 12 3 3 8v8l9 5 9-5z"/><path d="M3 8l9 5 9-5"/></svg>
              </div>
              <p className="text-sm font-semibold text-ink-900">Physical item</p>
              <p className="text-xs text-ink-500 mt-0.5">A tangible item that you will ship to buyers.</p>
            </button>
            <button type="button" disabled
              className="rounded-md border border-line bg-surface p-4 text-left opacity-60 cursor-not-allowed">
              <div className="h-10 w-10 rounded-md bg-canvas border border-line flex items-center justify-center text-ink-500 mb-2">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>
              </div>
              <p className="text-sm font-semibold text-ink-900 inline-flex items-center">Digital files <ComingSoonBadge /></p>
              <p className="text-xs text-ink-500 mt-0.5">A digital file that buyers will download.</p>
            </button>
          </div>
        </div>

        <Field label="When was it made?" required hint="Helps shoppers filter by era">
          <select className="input-field" value={draft.whenMade}
            onChange={(e) => setDraft({ whenMade: e.target.value as WhenMade })}>
            <option value="">When was it made?</option>
            {WHEN_MADE.map((w) => <option key={w.value} value={w.value}>{w.label}</option>)}
          </select>
        </Field>
      </div>
    </>
  );
}
