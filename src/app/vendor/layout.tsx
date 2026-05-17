'use client';
import Link from 'next/link';
import { DashboardShell, Icons, type NavItem } from '@/components/dashboard/DashboardShell';
import { ProfileMenu } from '@/components/dashboard/ProfileMenu';

const NAV: NavItem[] = [
  { label: 'Dashboard', href: '/vendor', icon: Icons.Home, match: (p) => p === '/vendor' },
  { label: 'Analytics', href: '/vendor/analytics', icon: Icons.Chart, match: (p) => p.startsWith('/vendor/analytics') },
  { label: 'Listings', href: '/vendor/products/new', icon: Icons.Tag, match: (p) => p.startsWith('/vendor/products') },
  { label: 'Sections', href: '/vendor/sections', icon: Icons.Layers, match: (p) => p.startsWith('/vendor/sections') },
  { label: 'Categories', href: '/vendor/categories', icon: Icons.Layers, match: (p) => p.startsWith('/vendor/categories') },
  { label: 'Pages', href: '/vendor/pages', icon: Icons.Layers, match: (p) => p.startsWith('/vendor/pages') },
  { label: 'Storefront', href: '/vendor/storefront', icon: Icons.Star, match: (p) => p.startsWith('/vendor/storefront') },
  { label: 'Return policies', href: '/vendor/policies', icon: Icons.Settings, match: (p) => p.startsWith('/vendor/policies') },
  { label: 'Orders', href: '/vendor/orders', icon: Icons.Box, match: (p) => p.startsWith('/vendor/orders') },
  { label: 'Coupons', href: '/vendor/coupons', icon: Icons.Tag, match: (p) => p.startsWith('/vendor/coupons') },
  { label: 'Reviews', href: '/vendor/reviews', icon: Icons.Star, match: (p) => p.startsWith('/vendor/reviews') },
  { label: 'Payouts', href: '/vendor/payouts', icon: Icons.Wallet, match: (p) => p.startsWith('/vendor/payouts') },
  { label: 'Payment methods', href: '/vendor/payments', icon: Icons.Wallet, match: (p) => p.startsWith('/vendor/payments') },
  { label: 'Shipping', href: '/vendor/shipping', icon: Icons.Box, match: (p) => p.startsWith('/vendor/shipping') },
];

export default function VendorLayout({ children }: { children: React.ReactNode }) {
  return (
    <DashboardShell
      brand={{ title: 'Vendor', subtitle: 'Shop manager', href: '/vendor' }}
      nav={NAV}
      topRight={
        <div className="flex items-center gap-2">
          <Link href="/vendor/storefront" className="hidden md:inline text-sm text-ink-700 hover:text-brand-700">
            Storefront ↗
          </Link>
          <button className="h-9 w-9 rounded-md hover:bg-canvas flex items-center justify-center text-ink-700" aria-label="Notifications">
            {Icons.Bell}
          </button>
          <ProfileMenu variant="vendor" />
        </div>
      }
    >
      {children}
    </DashboardShell>
  );
}
