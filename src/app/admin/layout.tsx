'use client';
import Link from 'next/link';
import { DashboardShell, Icons, type NavItem } from '@/components/dashboard/DashboardShell';
import { usePermissions, type Permission } from '@/lib/permissions';

const NAV: Array<NavItem & { perm?: Permission | Permission[] }> = [
  { label: 'Overview', href: '/admin', icon: Icons.Chart, match: (p) => p === '/admin' },
  { label: 'Vendor approvals', href: '/admin/vendors', icon: Icons.Users, match: (p) => p.startsWith('/admin/vendors'), perm: 'VENDOR_VIEW' },
  { label: 'Categories', href: '/admin/categories', icon: Icons.Layers, match: (p) => p.startsWith('/admin/categories'), perm: 'CATEGORY_MANAGE' },
  { label: 'Payouts', href: '/admin/payouts', icon: Icons.Wallet, match: (p) => p.startsWith('/admin/payouts'), perm: 'PAYOUT_VIEW' },
  { label: 'Payment methods', href: '/admin/payments', icon: Icons.Wallet, match: (p) => p.startsWith('/admin/payments'), perm: 'PAYMENT_METHOD_VIEW' },
  { label: 'Settings', href: '/admin/settings', icon: Icons.Settings, match: (p) => p.startsWith('/admin/settings'), perm: 'SETTINGS_MANAGE' },
  { label: 'Access control', href: '/admin/rbac/roles', icon: Icons.Users, match: (p) => p.startsWith('/admin/rbac'), perm: 'RBAC_MANAGE' },
  { label: 'Audit log', href: '/admin/rbac/audit', icon: Icons.Chart, match: (p) => p.startsWith('/admin/rbac/audit'), perm: 'AUDIT_VIEW' },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { has, loading } = usePermissions();

  const nav: NavItem[] = NAV.filter((item) => {
    if (!item.perm) return true;
    if (loading) return false;
    const perms = Array.isArray(item.perm) ? item.perm : [item.perm];
    return perms.some((p) => has(p));
  }).map(({ perm, ...rest }) => rest);

  return (
    <DashboardShell
      brand={{ eyebrow: 'Admin', title: 'Operations console', href: '/admin' }}
      nav={nav}
      topRight={
        <div className="flex items-center gap-2">
          <Link href="/" className="hidden md:inline text-sm text-ink-700 hover:text-brand-700">
            Storefront ↗
          </Link>
          <button className="h-9 w-9 rounded-md hover:bg-canvas flex items-center justify-center text-ink-700" aria-label="Notifications">
            {Icons.Bell}
          </button>
          <div className="h-8 w-8 rounded-full bg-ink-900 text-white text-xs font-bold flex items-center justify-center">A</div>
        </div>
      }
    >
      {children}
    </DashboardShell>
  );
}
