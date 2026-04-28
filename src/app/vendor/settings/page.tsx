'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';
import { PageHeader, Card } from '@/components/dashboard/DashboardShell';
import { defaultTheme, mergeTheme, VendorTheme, SocialPlatform, FONT_STACKS } from '@/lib/vendor-context';

interface Vendor {
  id: string;
  shopName: string;
  tagline: string | null;
  description: string | null;
  address: string | null;
  shopLogoUrl: string | null;
  bannerUrls: string[];
  themeColor: string | null;
  customDomain: string | null;
  theme: Partial<VendorTheme> | null;
}

const SOCIAL_PLATFORMS: SocialPlatform[] = [
  'instagram', 'facebook', 'twitter', 'youtube', 'whatsapp', 'pinterest', 'tiktok', 'linkedin',
];

interface BannerSlot {
  url: string;
  file?: File;
  preview: string;
}

const PRESET_COLORS = [
  '#F1641E', '#E53E3E', '#D69E2E', '#38A169',
  '#3182CE', '#805AD5', '#D53F8C', '#2D3748',
];

const MAX_BANNERS = 5;

type TabId = 'brand' | 'banners' | 'theme' | 'header' | 'footer' | 'domain';

interface FormState {
  shopName: string;
  tagline: string;
  description: string;
  address: string;
  themeColor: string;
  customDomain: string;
}

const TABS: { id: TabId; label: string; icon: React.ReactNode; hint: string }[] = [
  { id: 'brand',   label: 'Brand',    hint: 'Logo, name, story', icon: <IconStar /> },
  { id: 'banners', label: 'Banners',  hint: 'Hero slideshow',     icon: <IconImage /> },
  { id: 'theme',   label: 'Theme',    hint: 'Colors & fonts',     icon: <IconPalette /> },
  { id: 'header',  label: 'Header',   hint: 'Announcement & nav', icon: <IconLayout /> },
  { id: 'footer',  label: 'Footer',   hint: 'Links, socials',     icon: <IconFooter /> },
  { id: 'domain',  label: 'Domain',   hint: 'Custom URL',         icon: <IconGlobe /> },
];

export default function VendorSettingsPage() {
  const [vendor, setVendor]     = useState<Vendor | null>(null);
  const [savedForm, setSavedForm] = useState<FormState | null>(null);
  const [savedTheme, setSavedTheme] = useState<VendorTheme | null>(null);
  const [savedBanners, setSavedBanners] = useState<BannerSlot[]>([]);

  const [form, setForm]         = useState<FormState>({ shopName: '', tagline: '', description: '', address: '', themeColor: '#F1641E', customDomain: '' });
  const [theme, setTheme]       = useState<VendorTheme>(defaultTheme('#F1641E'));
  const [banners, setBanners]   = useState<BannerSlot[]>([]);

  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoFile, setLogoFile]       = useState<File | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [err, setErr]         = useState('');
  const [tab, setTab]         = useState<TabId>('brand');

  const logoRef    = useRef<HTMLInputElement>(null);
  const bannerRef  = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api<Vendor>('/api/vendors/me').then((v) => {
      setVendor(v);
      const f: FormState = {
        shopName:     v.shopName ?? '',
        tagline:      v.tagline ?? '',
        description:  v.description ?? '',
        address:      v.address ?? '',
        themeColor:   v.themeColor ?? '#F1641E',
        customDomain: v.customDomain ?? '',
      };
      const b = (v.bannerUrls ?? []).map((url) => ({ url, preview: url }));
      const t = mergeTheme(v.themeColor ?? '#F1641E', v.theme);
      setForm(f); setSavedForm(f);
      setBanners(b); setSavedBanners(b);
      setTheme(t); setSavedTheme(t);
      setLoading(false);
    });
  }, []);

  const dirty = useMemo(() => {
    if (!savedForm || !savedTheme) return false;
    if (logoFile) return true;
    if (JSON.stringify(form) !== JSON.stringify(savedForm)) return true;
    if (JSON.stringify(theme) !== JSON.stringify(savedTheme)) return true;
    if (banners.length !== savedBanners.length) return true;
    if (banners.some((b, i) => b.url !== savedBanners[i]?.url || !!b.file)) return true;
    return false;
  }, [form, savedForm, theme, savedTheme, banners, savedBanners, logoFile]);

  function discard() {
    if (!savedForm || !savedTheme) return;
    setForm(savedForm);
    setTheme(savedTheme);
    setBanners(savedBanners);
    setLogoFile(null);
    setLogoPreview(null);
    setErr('');
  }

  function onLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setLogoFile(f);
    setLogoPreview(URL.createObjectURL(f));
  }

  function onBannerFilesChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    const remaining = MAX_BANNERS - banners.length;
    const toAdd = files.slice(0, remaining);
    const newSlots: BannerSlot[] = toAdd.map((f) => ({ url: '', file: f, preview: URL.createObjectURL(f) }));
    setBanners((prev) => [...prev, ...newSlots]);
    e.target.value = '';
  }

  function removeBanner(idx: number) {
    setBanners((prev) => prev.filter((_, i) => i !== idx));
  }

  function moveBanner(idx: number, dir: -1 | 1) {
    setBanners((prev) => {
      const next = [...prev];
      const swap = idx + dir;
      if (swap < 0 || swap >= next.length) return prev;
      [next[idx], next[swap]] = [next[swap], next[idx]];
      return next;
    });
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErr('');
    try {
      const fd = new FormData();
      if (form.shopName)     fd.append('shopName', form.shopName);
      if (form.tagline)      fd.append('tagline', form.tagline);
      if (form.description)  fd.append('description', form.description);
      if (form.address)      fd.append('address', form.address);
      fd.append('themeColor', form.themeColor);
      if (form.customDomain !== undefined) fd.append('customDomain', form.customDomain);

      const cleanTheme: VendorTheme = {
        ...theme,
        header: {
          ...theme.header,
          navLinks: theme.header.navLinks.filter((l) => l.label.trim() && l.href.trim()),
        },
        footer: {
          ...theme.footer,
          columns: theme.footer.columns
            .map((c) => ({ ...c, links: c.links.filter((l) => l.label.trim() && l.href.trim()) }))
            .filter((c) => c.title.trim() && c.links.length > 0),
          socials: theme.footer.socials.filter((s) => s.url.trim()),
        },
      };
      fd.append('theme', JSON.stringify(cleanTheme));
      if (logoFile) fd.append('logo', logoFile);

      const keepUrls = banners.filter((b) => b.url).map((b) => b.url);
      fd.append('keepBannerUrls', JSON.stringify(keepUrls));
      banners.filter((b) => b.file).forEach((b) => fd.append('banners', b.file!));

      const updated = await api<Vendor>('/api/vendors/me/settings', { method: 'PATCH', body: fd });
      setVendor(updated);
      const newForm: FormState = {
        shopName:     updated.shopName ?? '',
        tagline:      updated.tagline ?? '',
        description:  updated.description ?? '',
        address:      updated.address ?? '',
        themeColor:   updated.themeColor ?? '#F1641E',
        customDomain: updated.customDomain ?? '',
      };
      const newBanners = (updated.bannerUrls ?? []).map((url) => ({ url, preview: url }));
      const newTheme = mergeTheme(updated.themeColor ?? '#F1641E', updated.theme);
      setForm(newForm); setSavedForm(newForm);
      setBanners(newBanners); setSavedBanners(newBanners);
      setTheme(newTheme); setSavedTheme(newTheme);
      setLogoFile(null);
      setLogoPreview(null);
      toast.success('Storefront updated');
    } catch (e: any) {
      setErr(e.message);
      toast.error(e.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-12 bg-surface border border-line rounded-md animate-pulse" />
        <div className="h-12 bg-surface border border-line rounded-md animate-pulse" />
        {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-40 bg-surface border border-line rounded-md animate-pulse" />)}
      </div>
    );
  }

  const logoSrc = logoPreview ?? vendor?.shopLogoUrl ?? null;

  return (
    <div className="pb-24">
      <PageHeader
        title="Shop settings"
        subtitle="Tailor every part of your storefront — branding, theme, and content."
        actions={
          <a href={`/store/${vendor?.id}`} target="_blank" rel="noreferrer" className="btn-secondary text-sm inline-flex items-center gap-1.5">
            <IconExternal /> View storefront
          </a>
        }
      />

      <form onSubmit={save}>
        {/* Tab navigation */}
        <div className="sticky top-14 z-20 -mx-4 md:-mx-8 px-4 md:px-8 bg-canvas/85 backdrop-blur border-b border-line mb-6">
          <div className="max-w-6xl mx-auto flex gap-1 overflow-x-auto no-scrollbar py-2">
            {TABS.map((t) => {
              const active = tab === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTab(t.id)}
                  className={[
                    'group flex items-center gap-2 px-4 h-10 rounded-pill text-sm whitespace-nowrap transition border',
                    active
                      ? 'bg-brand-50 border-brand-200 text-brand-700 font-semibold'
                      : 'bg-surface border-line text-ink-700 hover:border-ink-300 hover:text-ink-900',
                  ].join(' ')}
                >
                  <span className={active ? 'text-brand-700' : 'text-ink-500 group-hover:text-ink-700'}>{t.icon}</span>
                  <span>{t.label}</span>
                  <span className="hidden lg:inline text-[11px] opacity-60 font-normal">· {t.hint}</span>
                </button>
              );
            })}
          </div>
        </div>

        {err && (
          <div className="mb-4 rounded-md border border-red-100 bg-red-50 text-danger px-4 py-2.5 text-sm">{err}</div>
        )}

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {tab === 'brand'   && <BrandSection form={form} setForm={setForm} logoSrc={logoSrc} logoRef={logoRef} onLogoChange={onLogoChange} />}
            {tab === 'banners' && <BannersSection banners={banners} bannerRef={bannerRef} onBannerFilesChange={onBannerFilesChange} moveBanner={moveBanner} removeBanner={removeBanner} />}
            {tab === 'theme'   && <ThemeSection form={form} setForm={setForm} theme={theme} setTheme={setTheme} />}
            {tab === 'header'  && <HeaderSection theme={theme} setTheme={setTheme} />}
            {tab === 'footer'  && <FooterSection theme={theme} setTheme={setTheme} />}
            {tab === 'domain'  && <DomainSection form={form} setForm={setForm} />}
          </div>

          {/* Live preview rail */}
          <aside className="hidden lg:block">
            <div className="sticky top-32 space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-ink-500">Live preview</p>
              <PreviewPanel form={form} theme={theme} logoSrc={logoSrc} bannerPreview={banners[0]?.preview} />
              <p className="text-[11px] text-ink-500 leading-relaxed">
                Changes shown here are unsaved. Click <span className="font-semibold text-ink-700">Save</span> to publish.
              </p>
            </div>
          </aside>
        </div>
      </form>

      {/* Sticky save bar */}
      <div
        className={[
          'fixed bottom-0 left-0 right-0 z-50 transition-transform duration-200',
          dirty ? 'translate-y-0' : 'translate-y-full',
        ].join(' ')}
      >
        <div className="bg-ink-900 text-white border-t border-ink-900/50 shadow-2xl">
          <div className="max-w-6xl mx-auto px-4 md:px-8 py-3 flex items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-sm">
              <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
              <span>You have unsaved changes</span>
            </div>
            <div className="flex items-center gap-2">
              <button type="button" onClick={discard} disabled={saving}
                className="text-sm px-4 h-9 rounded-pill border border-white/20 hover:bg-white/10 transition">
                Discard
              </button>
              <button type="button" onClick={(e) => save(e as any)} disabled={saving}
                className="text-sm font-semibold px-5 h-9 rounded-pill bg-brand-600 hover:bg-brand-700 disabled:opacity-60 transition">
                {saving ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── SECTIONS ──────────────────────────────────────────────────────────────────
function SectionCard({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <Card>
      <div className="px-5 py-4 border-b border-line">
        <h2 className="font-semibold text-ink-900">{title}</h2>
        {subtitle && <p className="text-xs text-ink-500 mt-0.5">{subtitle}</p>}
      </div>
      <div className="p-5">{children}</div>
    </Card>
  );
}

function BrandSection({ form, setForm, logoSrc, logoRef, onLogoChange }: {
  form: FormState; setForm: (f: FormState) => void;
  logoSrc: string | null; logoRef: React.RefObject<HTMLInputElement>;
  onLogoChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <SectionCard title="Shop identity" subtitle="The face and voice of your storefront.">
      <div className="space-y-5">
        <div className="flex items-start gap-5">
          <div
            className="relative h-24 w-24 rounded-2xl overflow-hidden border-2 border-line bg-canvas cursor-pointer group shrink-0"
            onClick={() => logoRef.current?.click()}
          >
            {logoSrc
              ? <img src={logoSrc} alt="logo" className="w-full h-full object-cover" />
              : <div className="flex items-center justify-center h-full text-3xl font-bold text-ink-400">
                  {form.shopName?.[0]?.toUpperCase() || 'V'}
                </div>}
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white text-xs font-medium">
              Change
            </div>
          </div>
          <input ref={logoRef} type="file" accept="image/*" className="hidden" onChange={onLogoChange} />
          <div className="flex-1 space-y-3 min-w-0">
            <Field label="Shop name" required>
              <input className="input-field" value={form.shopName} onChange={(e) => setForm({ ...form, shopName: e.target.value })} placeholder="Your shop name" required />
            </Field>
            <Field label="Tagline" hint={`${form.tagline.length}/120`}>
              <input className="input-field" value={form.tagline} onChange={(e) => setForm({ ...form, tagline: e.target.value })} placeholder="Short catchy line about your shop" maxLength={120} />
            </Field>
          </div>
        </div>
        <Field label="Description" hint={`${form.description.length}/1000`}>
          <textarea className="input-field min-h-[100px] resize-y" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Tell customers what makes your shop special." maxLength={1000} />
        </Field>
        <Field label="Address (optional)">
          <input className="input-field" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="City, State" />
        </Field>
      </div>
    </SectionCard>
  );
}

function BannersSection({ banners, bannerRef, onBannerFilesChange, moveBanner, removeBanner }: {
  banners: BannerSlot[];
  bannerRef: React.RefObject<HTMLInputElement>;
  onBannerFilesChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  moveBanner: (idx: number, dir: -1 | 1) => void;
  removeBanner: (idx: number) => void;
}) {
  const remaining = MAX_BANNERS - banners.length;
  return (
    <SectionCard
      title="Hero banners"
      subtitle={`Up to ${MAX_BANNERS} slides rotate on your storefront. Recommended: 1400×500px.`}
    >
      <div className="space-y-3">
        {banners.length > 0 && (
          <div className="grid sm:grid-cols-2 gap-3">
            {banners.map((b, idx) => (
              <div key={idx} className="relative group rounded-lg overflow-hidden border border-line bg-canvas">
                <div className="aspect-[3/1] bg-surface">
                  <img src={b.preview} alt="" className="w-full h-full object-cover" />
                </div>
                <div className="absolute top-2 left-2 px-2 py-0.5 rounded-pill bg-black/60 text-white text-[10px] font-bold">
                  Slide {idx + 1}{b.file ? ' · new' : ''}
                </div>
                <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                  <button type="button" onClick={() => moveBanner(idx, -1)} disabled={idx === 0}
                    className="h-7 w-7 rounded-full bg-white/95 shadow flex items-center justify-center text-ink-700 disabled:opacity-30 hover:bg-white">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="m15 18-6-6 6-6"/></svg>
                  </button>
                  <button type="button" onClick={() => moveBanner(idx, 1)} disabled={idx === banners.length - 1}
                    className="h-7 w-7 rounded-full bg-white/95 shadow flex items-center justify-center text-ink-700 disabled:opacity-30 hover:bg-white">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="m9 18 6-6-6-6"/></svg>
                  </button>
                  <button type="button" onClick={() => removeBanner(idx)}
                    className="h-7 w-7 rounded-full bg-white/95 shadow flex items-center justify-center text-danger hover:bg-red-50">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {remaining > 0 && (
          <button
            type="button"
            onClick={() => bannerRef.current?.click()}
            className="w-full border-2 border-dashed border-line rounded-lg py-10 flex flex-col items-center gap-2 text-ink-500 hover:border-brand-400 hover:text-brand-700 hover:bg-brand-50/30 transition-colors"
          >
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/>
            </svg>
            <span className="text-sm font-semibold">Upload banner image</span>
            <span className="text-xs">{remaining} slot{remaining !== 1 ? 's' : ''} remaining</span>
          </button>
        )}
        <input ref={bannerRef} type="file" accept="image/*" multiple className="hidden" onChange={onBannerFilesChange} />
      </div>
    </SectionCard>
  );
}

function ThemeSection({ form, setForm, theme, setTheme }: {
  form: FormState; setForm: (f: FormState) => void;
  theme: VendorTheme; setTheme: (t: VendorTheme) => void;
}) {
  return (
    <>
      <SectionCard title="Brand color" subtitle="The dominant color used for buttons, accents, and highlights.">
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            {PRESET_COLORS.map((c) => {
              const active = form.themeColor.toLowerCase() === c.toLowerCase();
              return (
                <button key={c} type="button" onClick={() => setForm({ ...form, themeColor: c })}
                  className="relative h-10 w-10 rounded-full transition-transform hover:scale-110"
                  style={{ background: c }}
                  aria-label={c}
                >
                  {active && (
                    <span className="absolute inset-0 rounded-full ring-2 ring-offset-2 ring-ink-900" />
                  )}
                </button>
              );
            })}
            <label className="h-10 w-10 rounded-full border-2 border-dashed border-line cursor-pointer hover:scale-110 transition-transform overflow-hidden flex items-center justify-center text-ink-500" title="Custom color">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
              <input type="color" className="opacity-0 absolute w-10 h-10 cursor-pointer" value={form.themeColor} onChange={(e) => setForm({ ...form, themeColor: e.target.value })} />
            </label>
            <span className="text-sm font-mono text-ink-700 ml-1">{form.themeColor}</span>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Storefront palette" subtitle="Fine-tune background, text, header, and footer colors.">
        <div className="grid sm:grid-cols-2 gap-4">
          <ColorField label="Accent"      value={theme.colors.accent}     onChange={(v) => setTheme({ ...theme, colors: { ...theme.colors, accent: v } })} />
          <ColorField label="Background"  value={theme.colors.background} onChange={(v) => setTheme({ ...theme, colors: { ...theme.colors, background: v } })} />
          <ColorField label="Body text"   value={theme.colors.text}       onChange={(v) => setTheme({ ...theme, colors: { ...theme.colors, text: v } })} />
          <ColorField label="Header bg"   value={theme.colors.headerBg}   onChange={(v) => setTheme({ ...theme, colors: { ...theme.colors, headerBg: v } })} />
          <ColorField label="Header text" value={theme.colors.headerText} onChange={(v) => setTheme({ ...theme, colors: { ...theme.colors, headerText: v } })} />
          <ColorField label="Footer bg"   value={theme.colors.footerBg}   onChange={(v) => setTheme({ ...theme, colors: { ...theme.colors, footerBg: v } })} />
          <ColorField label="Footer text" value={theme.colors.footerText} onChange={(v) => setTheme({ ...theme, colors: { ...theme.colors, footerText: v } })} />
        </div>
      </SectionCard>

      <SectionCard title="Typography" subtitle="Font pairing for headings and body text.">
        <div className="grid sm:grid-cols-2 gap-4">
          <FontPicker label="Heading font" value={theme.typography.headingFont}
            options={[
              { value: 'display', label: 'Display', sample: 'Fraunces' },
              { value: 'serif',   label: 'Serif',   sample: 'Cormorant' },
              { value: 'sans',    label: 'Sans',    sample: 'Inter' },
            ]}
            onChange={(v) => setTheme({ ...theme, typography: { ...theme.typography, headingFont: v as any } })} />
          <FontPicker label="Body font" value={theme.typography.bodyFont}
            options={[
              { value: 'sans',  label: 'Sans',  sample: 'Inter' },
              { value: 'serif', label: 'Serif', sample: 'Cormorant' },
            ]}
            onChange={(v) => setTheme({ ...theme, typography: { ...theme.typography, bodyFont: v as any } })} />
        </div>
      </SectionCard>
    </>
  );
}

function HeaderSection({ theme, setTheme }: { theme: VendorTheme; setTheme: (t: VendorTheme) => void }) {
  return (
    <SectionCard title="Header" subtitle="Top announcement strip, marketplace link, and main nav.">
      <div className="space-y-5">
        <Field label="Announcement bar" hint={`${theme.header.announcement.length}/200 — leave blank to hide`}>
          <input className="input-field" maxLength={200} value={theme.header.announcement}
            onChange={(e) => setTheme({ ...theme, header: { ...theme.header, announcement: e.target.value } })}
            placeholder="Free shipping over ₹2,000 — limited time" />
        </Field>

        <Toggle
          label="Show ‘Marketplace’ back-link"
          description="Lets shoppers return to the main marketplace from your storefront."
          checked={theme.header.showMarketplaceLink}
          onChange={(v) => setTheme({ ...theme, header: { ...theme.header, showMarketplaceLink: v } })}
        />

        <Repeater
          title="Nav links"
          description="Up to 8 links shown in the header on desktop."
          max={8}
          items={theme.header.navLinks}
          onChange={(navLinks) => setTheme({ ...theme, header: { ...theme.header, navLinks } })}
          newItem={() => ({ label: '', href: '' })}
          render={(item, update) => (
            <>
              <input className="input-field flex-1 min-w-0" placeholder="Label (e.g. About)" value={item.label}
                onChange={(e) => update({ ...item, label: e.target.value })} />
              <input className="input-field flex-[2] min-w-0" placeholder="/path or https://…" value={item.href}
                onChange={(e) => update({ ...item, href: e.target.value })} />
            </>
          )}
        />
      </div>
    </SectionCard>
  );
}

function FooterSection({ theme, setTheme }: { theme: VendorTheme; setTheme: (t: VendorTheme) => void }) {
  return (
    <>
      <SectionCard title="Footer content" subtitle="About blurb, contact details, and copyright line.">
        <div className="space-y-5">
          <Field label="About blurb" hint={`${theme.footer.about.length}/500`}>
            <textarea className="input-field min-h-[80px] resize-y" maxLength={500} value={theme.footer.about}
              onChange={(e) => setTheme({ ...theme, footer: { ...theme.footer, about: e.target.value } })}
              placeholder="A short paragraph about your brand for the footer." />
          </Field>

          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Contact email">
              <input className="input-field" type="email" value={theme.footer.contactEmail}
                onChange={(e) => setTheme({ ...theme, footer: { ...theme.footer, contactEmail: e.target.value } })}
                placeholder="hello@yourshop.com" />
            </Field>
            <Field label="Contact phone">
              <input className="input-field" value={theme.footer.contactPhone}
                onChange={(e) => setTheme({ ...theme, footer: { ...theme.footer, contactPhone: e.target.value } })}
                placeholder="+91 90000 00000" />
            </Field>
          </div>

          <Field label="Copyright" hint="Leave blank for default">
            <input className="input-field" maxLength={200} value={theme.footer.copyright}
              onChange={(e) => setTheme({ ...theme, footer: { ...theme.footer, copyright: e.target.value } })}
              placeholder="© 2026 Your Shop. All rights reserved." />
          </Field>
        </div>
      </SectionCard>

      <SectionCard title="Social links" subtitle="Up to 8 platforms shown as icons in your footer.">
        <Repeater
          title=""
          max={8}
          items={theme.footer.socials}
          onChange={(socials) => setTheme({ ...theme, footer: { ...theme.footer, socials } })}
          newItem={() => ({ platform: 'instagram' as SocialPlatform, url: '' })}
          render={(item, update) => (
            <>
              <select className="input-field w-36 shrink-0" value={item.platform}
                onChange={(e) => update({ ...item, platform: e.target.value as SocialPlatform })}>
                {SOCIAL_PLATFORMS.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
              <input className="input-field flex-1 min-w-0" placeholder="https://…" value={item.url}
                onChange={(e) => update({ ...item, url: e.target.value })} />
            </>
          )}
        />
      </SectionCard>

      <SectionCard title="Footer link columns" subtitle="Group links like Policies, Help, Shop. Up to 4 columns.">
        <div className="space-y-4">
          {theme.footer.columns.map((col, ci) => (
            <div key={ci} className="border border-line rounded-lg bg-canvas">
              <div className="flex items-center gap-2 p-3 border-b border-line">
                <span className="h-6 w-6 rounded-full bg-brand-50 text-brand-700 text-xs font-bold flex items-center justify-center shrink-0">{ci + 1}</span>
                <input className="input-field flex-1" placeholder="Column title (e.g. Policies)" value={col.title}
                  onChange={(e) => setTheme({ ...theme, footer: { ...theme.footer, columns: updateArr(theme.footer.columns, ci, { ...col, title: e.target.value }) } })} />
                <button type="button" onClick={() => setTheme({ ...theme, footer: { ...theme.footer, columns: theme.footer.columns.filter((_, j) => j !== ci) } })}
                  className="h-8 w-8 rounded-md hover:bg-red-50 hover:text-danger flex items-center justify-center text-ink-500 shrink-0" aria-label="Remove column">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
                </button>
              </div>
              <div className="p-3 space-y-2">
                {col.links.map((l, li) => (
                  <div key={li} className="flex gap-2">
                    <input className="input-field flex-1 min-w-0" placeholder="Label" value={l.label}
                      onChange={(e) => {
                        const links = updateArr(col.links, li, { ...l, label: e.target.value });
                        setTheme({ ...theme, footer: { ...theme.footer, columns: updateArr(theme.footer.columns, ci, { ...col, links }) } });
                      }} />
                    <input className="input-field flex-[2] min-w-0" placeholder="/path or https://…" value={l.href}
                      onChange={(e) => {
                        const links = updateArr(col.links, li, { ...l, href: e.target.value });
                        setTheme({ ...theme, footer: { ...theme.footer, columns: updateArr(theme.footer.columns, ci, { ...col, links }) } });
                      }} />
                    <button type="button" onClick={() => {
                      const links = col.links.filter((_, j) => j !== li);
                      setTheme({ ...theme, footer: { ...theme.footer, columns: updateArr(theme.footer.columns, ci, { ...col, links }) } });
                    }} className="h-8 w-8 rounded-md hover:bg-red-50 hover:text-danger flex items-center justify-center text-ink-500 shrink-0" aria-label="Remove">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
                    </button>
                  </div>
                ))}
                {col.links.length < 10 && (
                  <button type="button"
                    onClick={() => {
                      const links = [...col.links, { label: '', href: '' }];
                      setTheme({ ...theme, footer: { ...theme.footer, columns: updateArr(theme.footer.columns, ci, { ...col, links }) } });
                    }}
                    className="text-xs font-semibold text-brand-700 hover:text-brand-800 inline-flex items-center gap-1">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
                    Add link
                  </button>
                )}
              </div>
            </div>
          ))}
          {theme.footer.columns.length < 4 ? (
            <button type="button"
              onClick={() => setTheme({ ...theme, footer: { ...theme.footer, columns: [...theme.footer.columns, { title: '', links: [{ label: '', href: '' }] }] } })}
              className="w-full border-2 border-dashed border-line rounded-lg py-4 text-sm font-semibold text-ink-500 hover:border-brand-400 hover:text-brand-700 hover:bg-brand-50/30 transition">
              + Add column
            </button>
          ) : (
            <p className="text-xs text-ink-500 text-center">Maximum 4 columns reached.</p>
          )}
        </div>
      </SectionCard>
    </>
  );
}

function DomainSection({ form, setForm }: { form: FormState; setForm: (f: FormState) => void }) {
  return (
    <SectionCard title="Custom domain" subtitle="Point your own domain to your storefront for full white-labeling.">
      <div className="space-y-4">
        <Field label="Domain">
          <input className="input-field font-mono" value={form.customDomain}
            onChange={(e) => setForm({ ...form, customDomain: e.target.value.toLowerCase().trim() })}
            placeholder="shop.yourbrand.com" />
        </Field>
        {form.customDomain ? (
          <div className="bg-canvas rounded-lg border border-line p-4 text-xs space-y-2 text-ink-700">
            <p className="font-semibold text-ink-900 flex items-center gap-1.5">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>
              DNS setup
            </p>
            <p>Add a CNAME record at your DNS provider:</p>
            <div className="font-mono bg-surface border border-line rounded px-3 py-2 space-y-1">
              <div className="flex gap-4"><span className="text-ink-500 w-16">Type</span><span>CNAME</span></div>
              <div className="flex gap-4"><span className="text-ink-500 w-16">Name</span><span>{form.customDomain.split('.').slice(0, -2).join('.') || '@'}</span></div>
              <div className="flex gap-4"><span className="text-ink-500 w-16">Value</span><span>{typeof window !== 'undefined' ? window.location.hostname : 'yourapp.com'}</span></div>
            </div>
          </div>
        ) : (
          <p className="text-xs text-ink-500">No domain set. Your shop is reachable at the default subdomain.</p>
        )}
      </div>
    </SectionCard>
  );
}

// ── PREVIEW ───────────────────────────────────────────────────────────────────
function PreviewPanel({ form, theme, logoSrc, bannerPreview }: {
  form: FormState; theme: VendorTheme; logoSrc: string | null; bannerPreview?: string;
}) {
  return (
    <div className="rounded-xl border border-line bg-surface overflow-hidden shadow-card">
      <div className="bg-ink-900 text-white text-[10px] font-mono px-3 py-1.5 flex items-center gap-2">
        <span className="h-2 w-2 rounded-full bg-red-400" />
        <span className="h-2 w-2 rounded-full bg-amber-400" />
        <span className="h-2 w-2 rounded-full bg-emerald-400" />
        <span className="ml-2 opacity-70 truncate">{form.customDomain || `store/${(form.shopName || 'shop').toLowerCase().replace(/\s+/g,'-')}`}</span>
      </div>

      <div style={{ background: theme.colors.background, color: theme.colors.text, fontFamily: FONT_STACKS[theme.typography.bodyFont] }}>
        {/* announcement */}
        {theme.header.announcement && (
          <div className="text-center text-[10px] font-medium py-1 px-2 truncate" style={{ background: form.themeColor, color: '#fff' }}>
            {theme.header.announcement}
          </div>
        )}
        {/* header */}
        <div className="flex items-center gap-2 px-3 h-11" style={{ background: theme.colors.headerBg, color: theme.colors.headerText, borderBottom: '1px solid rgba(0,0,0,0.08)' }}>
          {logoSrc
            ? <img src={logoSrc} alt="" className="h-7 w-7 rounded-full object-cover" />
            : <div className="h-7 w-7 rounded-full text-white text-xs font-bold flex items-center justify-center" style={{ background: form.themeColor }}>
                {(form.shopName?.[0] || 'V').toUpperCase()}
              </div>}
          <span className="text-sm font-bold truncate" style={{ color: form.themeColor, fontFamily: FONT_STACKS[theme.typography.headingFont] }}>
            {form.shopName || 'Your Shop'}
          </span>
          <div className="ml-auto flex items-center gap-2 text-[10px]">
            {(theme.header.navLinks.filter((l) => l.label).slice(0, 3)).map((l, i) => (
              <span key={i} className="opacity-80">{l.label}</span>
            ))}
            <span className="h-5 w-5 rounded-full border" style={{ borderColor: 'rgba(0,0,0,0.15)' }} />
          </div>
        </div>

        {/* hero */}
        <div className="aspect-[16/7] relative overflow-hidden">
          {bannerPreview
            ? <img src={bannerPreview} alt="" className="w-full h-full object-cover" />
            : <div className="w-full h-full" style={{ background: `linear-gradient(160deg, ${form.themeColor}cc, ${form.themeColor}33)` }} />
          }
        </div>

        {/* fake products */}
        <div className="p-3 grid grid-cols-3 gap-2">
          {[0,1,2].map((i) => (
            <div key={i} className="space-y-1">
              <div className="aspect-square rounded bg-canvas border border-line" />
              <div className="h-1.5 w-3/4 bg-canvas rounded" />
              <div className="h-1.5 w-1/2 bg-canvas rounded" />
            </div>
          ))}
        </div>

        {/* footer */}
        <div className="px-3 py-3 text-[9px]" style={{ background: theme.colors.footerBg, color: theme.colors.footerText }}>
          {theme.footer.about && <p className="line-clamp-2 mb-1.5 opacity-80">{theme.footer.about}</p>}
          {theme.footer.socials.filter((s) => s.url).length > 0 && (
            <div className="flex gap-1 mb-1.5">
              {theme.footer.socials.filter((s) => s.url).slice(0,5).map((s, i) => (
                <span key={i} className="h-4 w-4 rounded-full" style={{ background: 'rgba(0,0,0,0.1)' }} />
              ))}
            </div>
          )}
          <p className="opacity-60">{theme.footer.copyright || `© ${new Date().getFullYear()} ${form.shopName || 'Your Shop'}.`}</p>
        </div>
      </div>
    </div>
  );
}

// ── PRIMITIVES ───────────────────────────────────────────────────────────────
function Field({ label, children, hint, required }: { label: string; children: React.ReactNode; hint?: string; required?: boolean }) {
  return (
    <label className="block">
      <span className="flex items-center justify-between mb-1.5">
        <span className="text-xs font-semibold uppercase tracking-wide text-ink-700">
          {label}{required && <span className="text-danger ml-0.5">*</span>}
        </span>
        {hint && <span className="text-[11px] text-ink-500 font-normal normal-case tracking-normal">{hint}</span>}
      </span>
      {children}
    </label>
  );
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="block text-xs font-semibold uppercase tracking-wide text-ink-700 mb-1.5">{label}</span>
      <div className="flex items-center gap-2">
        <div className="relative h-9 w-9 rounded-md border border-line overflow-hidden cursor-pointer shrink-0" style={{ background: value }}>
          <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="absolute inset-0 opacity-0 cursor-pointer" />
        </div>
        <input className="input-field font-mono text-sm" value={value} onChange={(e) => onChange(e.target.value)} />
      </div>
    </label>
  );
}

function FontPicker({ label, value, options, onChange }: {
  label: string; value: string;
  options: { value: string; label: string; sample: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <span className="block text-xs font-semibold uppercase tracking-wide text-ink-700 mb-1.5">{label}</span>
      <div className="grid grid-cols-3 gap-2">
        {options.map((o) => {
          const active = o.value === value;
          return (
            <button key={o.value} type="button" onClick={() => onChange(o.value)}
              className={[
                'rounded-md border px-2 py-2 text-left transition',
                active ? 'border-brand-600 bg-brand-50 ring-1 ring-brand-600' : 'border-line bg-surface hover:border-ink-300',
              ].join(' ')}
            >
              <p className="text-[10px] uppercase tracking-wide font-bold text-ink-500">{o.label}</p>
              <p className="text-base text-ink-900 leading-tight" style={{ fontFamily: FONT_STACKS[o.value] }}>{o.sample}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Toggle({ label, description, checked, onChange }: {
  label: string; description?: string; checked: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <button type="button" onClick={() => onChange(!checked)}
      className="w-full flex items-start gap-3 p-3 rounded-md border border-line bg-canvas hover:bg-surface text-left transition">
      <span className={['mt-0.5 h-5 w-9 rounded-full transition-colors shrink-0 relative', checked ? 'bg-brand-600' : 'bg-ink-300'].join(' ')}>
        <span className={['absolute top-0.5 h-4 w-4 bg-white rounded-full shadow transition-transform', checked ? 'translate-x-4' : 'translate-x-0.5'].join(' ')} />
      </span>
      <span className="flex-1 min-w-0">
        <span className="block text-sm font-semibold text-ink-900">{label}</span>
        {description && <span className="block text-xs text-ink-500 mt-0.5">{description}</span>}
      </span>
    </button>
  );
}

function Repeater<T>({ title, description, max, items, newItem, render, onChange }: {
  title: string;
  description?: string;
  max: number;
  items: T[];
  newItem: () => T;
  render: (item: T, update: (next: T) => void) => React.ReactNode;
  onChange: (next: T[]) => void;
}) {
  return (
    <div>
      {title && (
        <div className="mb-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-700">{title}</p>
          {description && <p className="text-[11px] text-ink-500 mt-0.5">{description}</p>}
        </div>
      )}
      <div className="space-y-2">
        {items.length === 0 && (
          <p className="text-xs text-ink-500 italic">No entries yet.</p>
        )}
        {items.map((item, i) => (
          <div key={i} className="flex gap-2 items-center">
            <span className="h-7 w-7 rounded-full bg-canvas border border-line text-xs font-bold flex items-center justify-center text-ink-500 shrink-0">{i + 1}</span>
            {render(item, (next) => onChange(updateArr(items, i, next)))}
            <button type="button" onClick={() => onChange(items.filter((_, j) => j !== i))}
              className="h-8 w-8 rounded-md hover:bg-red-50 hover:text-danger flex items-center justify-center text-ink-500 shrink-0" aria-label="Remove">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
            </button>
          </div>
        ))}
        {items.length < max && (
          <button type="button" onClick={() => onChange([...items, newItem()])}
            className="text-sm font-semibold text-brand-700 hover:text-brand-800 inline-flex items-center gap-1">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
            Add
          </button>
        )}
      </div>
    </div>
  );
}

function updateArr<T>(arr: T[], idx: number, val: T): T[] {
  const next = [...arr];
  next[idx] = val;
  return next;
}

// ── ICONS ─────────────────────────────────────────────────────────────────────
function IconStar()    { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2.5l2.95 6.4 6.55.6-4.95 4.55 1.4 6.45L12 17.6l-5.95 2.9 1.4-6.45L2.5 9.5l6.55-.6L12 2.5z"/></svg>; }
function IconImage()   { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/></svg>; }
function IconPalette() { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22a10 10 0 1 1 10-10c0 2.5-2 4-4 4h-2a2 2 0 0 0-2 2c0 .8.6 1.6.6 2.4 0 1-.7 1.6-1.6 1.6H12z"/><circle cx="7.5" cy="10.5" r="1"/><circle cx="12" cy="7.5" r="1"/><circle cx="16.5" cy="10.5" r="1"/></svg>; }
function IconLayout()  { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>; }
function IconFooter()  { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 16h18"/></svg>; }
function IconGlobe()   { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20"/></svg>; }
function IconExternal(){ return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></svg>; }
