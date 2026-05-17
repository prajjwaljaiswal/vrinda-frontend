// Marketplace home (server-component wrapper).
//
// Why this exists as a wrapper:
//   Next.js 14 has a known bug (vercel/next.js#58272, #54187) where a
//   route-group's root `page.tsx` declared with `'use client'` sometimes
//   fails to emit `page_client-reference-manifest.js` during production
//   build, breaking deploys with:
//     ENOENT: ... /.next/server/app/(main)/page_client-reference-manifest.js
//   Keeping `page.tsx` as a server component and delegating to a child
//   client component is the well-known workaround.
//
// Also opt out of static prerendering — the home page fetches live products.

import MarketplaceHome from './MarketplaceHome';

export const dynamic = 'force-dynamic';

export default function Page() {
  return <MarketplaceHome />;
}
