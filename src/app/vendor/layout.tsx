'use client';
import Link from 'next/link';
import { DashboardShell, Icons, type NavItem } from '@/components/dashboard/DashboardShell';

const NAV: NavItem[] = [
  { label: 'Dashboard', href: '/vendor', icon: Icons.Home, match: (p) => p === '/vendor' },
  { label: 'Listings', href: '/vendor/products/new', icon: Icons.Tag, match: (p) => p.startsWith('/vendor/products') },
  { label: 'Sections', href: '/vendor/sections', icon: Icons.Layers, match: (p) => p.startsWith('/vendor/sections') },
  { label: 'Return policies', href: '/vendor/policies', icon: Icons.Settings, match: (p) => p.startsWith('/vendor/policies') },
  { label: 'Orders', href: '/vendor/orders', icon: Icons.Box, match: (p) => p.startsWith('/vendor/orders') },
  { label: 'Reviews', href: '/vendor/reviews', icon: Icons.Star, match: (p) => p.startsWith('/vendor/reviews') },
  { label: 'Payouts', href: '/vendor/payouts', icon: Icons.Wallet, match: (p) => p.startsWith('/vendor/payouts') },
  { label: 'Payment methods', href: '/vendor/payments', icon: Icons.Wallet, match: (p) => p.startsWith('/vendor/payments') },
  { label: 'Shipping', href: '/vendor/shipping', icon: Icons.Box, match: (p) => p.startsWith('/vendor/shipping') },
  { label: 'Shop settings', href: '/vendor/settings', icon: Icons.Settings, match: (p) => p.startsWith('/vendor/settings') || p.startsWith('/vendor/onboard') },
];

export default function VendorLayout({ children }: { children: React.ReactNode }) {
  return (
    <DashboardShell
      brand={{ title: 'Vendor', subtitle: 'Shop manager', href: '/vendor' }}
      nav={NAV}
      topRight={
        <div className="flex items-center gap-2">
          <Link href="/vendor/settings" className="hidden md:inline text-sm text-ink-700 hover:text-brand-700">
            Storefront ↗
          </Link>
          <button className="h-9 w-9 rounded-md hover:bg-canvas flex items-center justify-center text-ink-700" aria-label="Notifications">
            {Icons.Bell}
          </button>
          <div className="h-8 w-8 rounded-full bg-brand-50 text-brand-700 text-xs font-bold flex items-center justify-center">V</div>
        </div>
      }
    >
      {children}
    </DashboardShell>
  );
}
