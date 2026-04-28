'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { StepHeader, StepProps, Field } from '../StepShell';

interface AttributeOption { id: string; value: string }
interface Attribute { id: string; name: string; inputType: 'SELECT' | 'TEXT' | 'NUMBER'; isRequired: boolean; options: AttributeOption[] }

const METALS = ['gold', 'silver', 'platinum', 'other'];

export function DetailsStep({ draft, setDraft }: StepProps) {
  const [attributes, setAttributes] = useState<Attribute[]>([]);

  useEffect(() => {
    if (!draft.categoryId) { setAttributes([]); return; }
    api<Attribute[]>(`/api/categories/${draft.categoryId}/attributes`, { auth: false })
      .then(setAttributes)
      .catch(() => setAttributes([]));
  }, [draft.categoryId]);

  return (
    <>
      <StepHeader
        title="Item details"
        subtitle="Help buyers understand your item better, and any special options you offer."
      />
      <div className="p-6 space-y-5">
        <Field label="Title" required hint={`${draft.title.length}/140`}>
          <textarea
            className="input-field min-h-[60px] resize-none"
            placeholder="e.g. 22k Gold Kundan Choker — Handcrafted Bridal Necklace"
            maxLength={140}
            value={draft.title}
            onChange={(e) => setDraft({ title: e.target.value })}
          />
          <span className="block text-[11px] text-ink-500 mt-1">
            Make sure your title is easy to understand and clearly describes the item you're selling.
          </span>
        </Field>

        <Field label="Description" required hint={`${draft.description.length} chars`}>
          <textarea
            className="input-field min-h-[160px] resize-y"
            placeholder="Materials, dimensions, what's included, care instructions…"
            value={draft.description}
            onChange={(e) => setDraft({ description: e.target.value })}
          />
          <span className="block text-[11px] text-ink-500 mt-1">
            What makes your item special? Buyers see the first few lines unless they expand.
          </span>
        </Field>

        <Field label="Primary metal" hint="Used by the marketplace metal filter">
          <select className="input-field max-w-xs" value={draft.metalType}
            onChange={(e) => setDraft({ metalType: e.target.value })}>
            {METALS.map((m) => <option key={m} value={m}>{m[0].toUpperCase() + m.slice(1)}</option>)}
          </select>
        </Field>

        {!draft.categoryId && (
          <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
            Pick a category first to see additional details for your listing.
          </div>
        )}

        {attributes.length > 0 && (
          <div className="border-t border-line pt-5">
            <p className="text-sm font-semibold text-ink-900 mb-3">Category details</p>
            <div className="grid md:grid-cols-2 gap-4">
              {attributes.map((attr) => (
                <Field key={attr.id} label={attr.name} required={attr.isRequired}>
                  {attr.inputType === 'SELECT' ? (
                    <select className="input-field"
                      value={draft.attrValues[attr.id] || ''}
                      onChange={(e) => setDraft({ attrValues: { ...draft.attrValues, [attr.id]: e.target.value } })}>
                      <option value="">— Select —</option>
                      {attr.options.map((o) => <option key={o.id} value={o.value}>{o.value}</option>)}
                    </select>
                  ) : (
                    <input type={attr.inputType === 'NUMBER' ? 'number' : 'text'} className="input-field"
                      value={draft.attrValues[attr.id] || ''}
                      onChange={(e) => setDraft({ attrValues: { ...draft.attrValues, [attr.id]: e.target.value } })} />
                  )}
                </Field>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
