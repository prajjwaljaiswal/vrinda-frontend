'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { PageHeader, Card, StatusPill } from '@/components/dashboard/DashboardShell';

interface CategoryAttributeOption { id: string; value: string; sortOrder: number; }
interface CategoryAttribute {
  id: string; name: string;
  inputType: 'SELECT' | 'TEXT' | 'NUMBER';
  isRequired: boolean; sortOrder: number;
  options: CategoryAttributeOption[];
}
interface Category {
  id: string; name: string; slug: string;
  description: string | null; isActive: boolean; sortOrder: number;
  _count: { products: number };
}

function toSlug(name: string) {
  return name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
}

export default function AdminCategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [attributes, setAttributes] = useState<Record<string, CategoryAttribute[]>>({});
  const [err, setErr] = useState('');

  const [addForm, setAddForm] = useState({ name: '', slug: '', description: '', sortOrder: '0' });
  const [addErr, setAddErr] = useState('');

  const [editId, setEditId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: '', slug: '', description: '', sortOrder: '0' });

  const [attrForm, setAttrForm] = useState({ name: '', inputType: 'SELECT', isRequired: false, sortOrder: '0' });
  const [attrErr, setAttrErr] = useState('');
  const [optionInputs, setOptionInputs] = useState<Record<string, string>>({});

  async function loadCategories() {
    try { setCategories(await api<Category[]>('/api/categories/all')); }
    catch (e: any) { setErr(e.message); }
  }
  async function loadAttributes(categoryId: string) {
    const data = await api<CategoryAttribute[]>(`/api/categories/${categoryId}/attributes`);
    setAttributes((prev) => ({ ...prev, [categoryId]: data }));
  }
  useEffect(() => { loadCategories(); }, []);

  async function handleExpand(id: string) {
    if (expandedId === id) { setExpandedId(null); return; }
    setExpandedId(id); setAttrErr('');
    if (!attributes[id]) await loadAttributes(id);
  }

  async function handleAddCategory(e: React.FormEvent) {
    e.preventDefault(); setAddErr('');
    try {
      await api('/api/categories', {
        method: 'POST',
        body: JSON.stringify({
          name: addForm.name, slug: addForm.slug,
          description: addForm.description || undefined,
          sortOrder: parseInt(addForm.sortOrder) || 0,
        }),
      });
      setAddForm({ name: '', slug: '', description: '', sortOrder: '0' });
      await loadCategories();
    } catch (e: any) { setAddErr(e.message); }
  }
  async function handleUpdateCategory(id: string) {
    try {
      await api(`/api/categories/${id}`, {
        method: 'PUT',
        body: JSON.stringify({
          name: editForm.name, slug: editForm.slug,
          description: editForm.description || undefined,
          sortOrder: parseInt(editForm.sortOrder) || 0,
        }),
      });
      setEditId(null); await loadCategories();
    } catch (e: any) { setErr(e.message); }
  }
  async function handleToggleActive(cat: Category) {
    try { await api(`/api/categories/${cat.id}`, { method: 'PUT', body: JSON.stringify({ isActive: !cat.isActive }) }); await loadCategories(); }
    catch (e: any) { setErr(e.message); }
  }
  async function handleDeleteCategory(id: string) {
    try { await api(`/api/categories/${id}`, { method: 'DELETE' }); await loadCategories(); }
    catch (e: any) { setErr(e.message); }
  }
  async function handleAddAttribute(e: React.FormEvent, categoryId: string) {
    e.preventDefault(); setAttrErr('');
    try {
      await api(`/api/categories/${categoryId}/attributes`, {
        method: 'POST',
        body: JSON.stringify({
          name: attrForm.name, inputType: attrForm.inputType,
          isRequired: attrForm.isRequired,
          sortOrder: parseInt(attrForm.sortOrder) || 0,
        }),
      });
      setAttrForm({ name: '', inputType: 'SELECT', isRequired: false, sortOrder: '0' });
      await loadAttributes(categoryId);
    } catch (e: any) { setAttrErr(e.message); }
  }
  async function handleDeleteAttribute(categoryId: string, attrId: string) {
    try { await api(`/api/categories/attributes/${attrId}`, { method: 'DELETE' }); await loadAttributes(categoryId); }
    catch (e: any) { setErr(e.message); }
  }
  async function handleAddOption(categoryId: string, attrId: string) {
    const value = (optionInputs[attrId] || '').trim();
    if (!value) return;
    try {
      await api(`/api/categories/attributes/${attrId}/options`, { method: 'POST', body: JSON.stringify({ value }) });
      setOptionInputs((prev) => ({ ...prev, [attrId]: '' }));
      await loadAttributes(categoryId);
    } catch (e: any) { setErr(e.message); }
  }
  async function handleDeleteOption(categoryId: string, optId: string) {
    try { await api(`/api/categories/attributes/options/${optId}`, { method: 'DELETE' }); await loadAttributes(categoryId); }
    catch (e: any) { setErr(e.message); }
  }

  return (
    <div>
      <PageHeader title="Categories" subtitle="Define how vendors classify their listings and which attributes shoppers can filter by." />

      {err && (
        <div className="mb-4 rounded-md bg-red-50 border border-red-100 text-danger text-sm p-3 flex justify-between">
          <span>{err}</span>
          <button onClick={() => setErr('')} className="font-bold">×</button>
        </div>
      )}

      <Card className="p-5 mb-6">
        <h3 className="font-semibold text-ink-900 mb-3">Add a category</h3>
        <form onSubmit={handleAddCategory} className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <input className="input-field" placeholder="Name"
            value={addForm.name}
            onChange={(e) => setAddForm({ ...addForm, name: e.target.value, slug: toSlug(e.target.value) })} required />
          <input className="input-field" placeholder="Slug"
            value={addForm.slug} onChange={(e) => setAddForm({ ...addForm, slug: e.target.value })} required />
          <input className="input-field" placeholder="Description (optional)"
            value={addForm.description} onChange={(e) => setAddForm({ ...addForm, description: e.target.value })} />
          <div className="flex gap-2">
            <input className="input-field w-24" type="number" min="0" placeholder="Order"
              value={addForm.sortOrder} onChange={(e) => setAddForm({ ...addForm, sortOrder: e.target.value })} />
            <button className="btn-primary !px-4 !py-2 text-sm flex-1">Add</button>
          </div>
          {addErr && <p className="text-danger text-xs md:col-span-4">{addErr}</p>}
        </form>
      </Card>

      {categories.length === 0 ? (
        <Card className="p-10 text-center text-ink-700">No categories yet — add your first one above.</Card>
      ) : (
        <div className="space-y-3">
          {categories.map((cat) => (
            <Card key={cat.id} className="overflow-hidden">
              <div className="flex items-center gap-3 px-5 py-4">
                {editId === cat.id ? (
                  <div className="flex flex-wrap gap-2 flex-1">
                    <input className="input-field h-9 flex-1 min-w-32 text-sm"
                      value={editForm.name}
                      onChange={(e) => setEditForm({ ...editForm, name: e.target.value, slug: toSlug(e.target.value) })} />
                    <input className="input-field h-9 flex-1 min-w-32 text-sm"
                      value={editForm.slug} onChange={(e) => setEditForm({ ...editForm, slug: e.target.value })} />
                    <input className="input-field h-9 w-20 text-sm" type="number" min="0"
                      value={editForm.sortOrder} onChange={(e) => setEditForm({ ...editForm, sortOrder: e.target.value })} />
                    <button onClick={() => handleUpdateCategory(cat.id)} className="btn-primary !px-3 !py-1.5 text-xs">Save</button>
                    <button onClick={() => setEditId(null)} className="btn-secondary !px-3 !py-1.5 text-xs">Cancel</button>
                  </div>
                ) : (
                  <>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-ink-900">{cat.name}</span>
                        <span className="text-xs text-ink-500">/{cat.slug}</span>
                        <span className="text-xs text-ink-500">· #{cat.sortOrder}</span>
                        <span className="text-xs text-ink-500">· {cat._count.products} products</span>
                      </div>
                    </div>
                    <StatusPill tone={cat.isActive ? 'success' : 'neutral'}>{cat.isActive ? 'Active' : 'Inactive'}</StatusPill>
                    <button onClick={() => { setEditId(cat.id); setEditForm({ name: cat.name, slug: cat.slug, description: cat.description || '', sortOrder: String(cat.sortOrder) }); }} className="text-xs px-3 py-1.5 rounded-pill border border-line hover:border-ink-900">Edit</button>
                    <button onClick={() => handleToggleActive(cat)} className={`text-xs px-3 py-1.5 rounded-pill border ${cat.isActive ? 'bg-amber-50 text-warn border-amber-100' : 'bg-emerald-50 text-success border-emerald-100'}`}>
                      {cat.isActive ? 'Deactivate' : 'Activate'}
                    </button>
                    <button onClick={() => handleDeleteCategory(cat.id)} className="text-xs px-3 py-1.5 rounded-pill bg-red-50 text-danger border border-red-100">Delete</button>
                    <button onClick={() => handleExpand(cat.id)} className="text-xs px-3 py-1.5 rounded-pill border border-line hover:border-ink-900">
                      {expandedId === cat.id ? 'Hide attributes ▲' : 'Attributes ▼'}
                    </button>
                  </>
                )}
              </div>

              {expandedId === cat.id && (
                <div className="border-t border-line bg-canvas px-5 py-5">
                  <h4 className="text-sm font-semibold text-ink-900 mb-3">Attributes for {cat.name}</h4>

                  <form onSubmit={(e) => handleAddAttribute(e, cat.id)} className="flex flex-wrap gap-2 mb-4">
                    <input className="input-field h-9 flex-1 min-w-40 text-sm" placeholder="Attribute name (e.g. Size)"
                      value={attrForm.name} onChange={(e) => setAttrForm({ ...attrForm, name: e.target.value })} required />
                    <select className="input-field h-9 text-sm w-44"
                      value={attrForm.inputType} onChange={(e) => setAttrForm({ ...attrForm, inputType: e.target.value })}>
                      <option value="SELECT">Select (dropdown)</option>
                      <option value="TEXT">Text (free input)</option>
                      <option value="NUMBER">Number</option>
                    </select>
                    <label className="flex items-center gap-2 text-sm text-ink-700">
                      <input type="checkbox" checked={attrForm.isRequired}
                        onChange={(e) => setAttrForm({ ...attrForm, isRequired: e.target.checked })} />
                      Required
                    </label>
                    <button type="submit" className="btn-primary !px-3 !py-1.5 text-xs">+ Add attribute</button>
                  </form>
                  {attrErr && <p className="text-danger text-xs mb-3">{attrErr}</p>}

                  {(attributes[cat.id] || []).length === 0 ? (
                    <p className="text-sm text-ink-500">No attributes yet.</p>
                  ) : (
                    <div className="space-y-3">
                      {(attributes[cat.id] || []).map((attr) => (
                        <div key={attr.id} className="rounded-md bg-surface border border-line p-4">
                          <div className="flex items-center gap-2 flex-wrap mb-3">
                            <span className="font-semibold text-ink-900 text-sm">{attr.name}</span>
                            <StatusPill tone="neutral">{attr.inputType}</StatusPill>
                            {attr.isRequired && <StatusPill tone="danger">Required</StatusPill>}
                            <button onClick={() => handleDeleteAttribute(cat.id, attr.id)} className="ml-auto text-xs px-2.5 py-1 rounded-pill bg-red-50 text-danger border border-red-100">Delete</button>
                          </div>
                          {attr.inputType === 'SELECT' ? (
                            <div>
                              <div className="flex flex-wrap gap-1.5 mb-2">
                                {attr.options.map((opt) => (
                                  <span key={opt.id} className="chip">
                                    {opt.value}
                                    <button onClick={() => handleDeleteOption(cat.id, opt.id)} className="text-ink-500 hover:text-danger">×</button>
                                  </span>
                                ))}
                              </div>
                              <div className="flex gap-2">
                                <input className="input-field h-9 text-sm flex-1" placeholder="Add option value"
                                  value={optionInputs[attr.id] || ''}
                                  onChange={(e) => setOptionInputs((prev) => ({ ...prev, [attr.id]: e.target.value }))}
                                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddOption(cat.id, attr.id))} />
                                <button onClick={() => handleAddOption(cat.id, attr.id)} className="btn-secondary !px-3 !py-1.5 text-xs">Add</button>
                              </div>
                            </div>
                          ) : (
                            <p className="text-xs text-ink-500">Vendors enter this value freely when listing a product.</p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
