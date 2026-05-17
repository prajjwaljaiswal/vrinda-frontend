// The legacy Shop settings page has been superseded by the Storefront builder.
// Any direct hit on /vendor/settings is redirected to /vendor/storefront where
// vendors now manage presets, system pages (homepage / PDP / cart / checkout),
// and (in follow-up work) brand/header/footer/domain settings.

import { redirect } from 'next/navigation';

export default function VendorSettingsRedirect() {
  redirect('/vendor/storefront');
}
