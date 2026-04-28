'use client';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface CartItem {
  productId: string;
  name: string;
  price: number;
  image: string;
  quantity: number;
  vendorId?: string;
  vendorName: string;
  // Variation snapshot — same productId with different combos = distinct lines.
  variationComboId?: string;
  variationLabel?: string;
}

// Composite key so a product with multiple combo selections gets distinct cart lines.
const lineKey = (i: { productId: string; variationComboId?: string }) =>
  i.variationComboId ? `${i.productId}::${i.variationComboId}` : i.productId;

export type AddResult =
  | { status: 'added' | 'incremented' }
  | { status: 'conflict'; existingVendor: string; newVendor: string };

interface CartState {
  items: CartItem[];
  add: (item: Omit<CartItem, 'quantity'>, qty?: number) => AddResult;
  /** Replaces the cart with a single item from a different vendor. Used after a confirmed conflict. */
  replaceWith: (item: Omit<CartItem, 'quantity'>, qty?: number) => void;
  remove: (productId: string, variationComboId?: string) => void;
  setQty: (productId: string, qty: number, variationComboId?: string) => void;
  clear: () => void;
  total: () => number;
  vendorId: () => string | null;
  vendorName: () => string | null;
}

export const useCart = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      add: (item, qty = 1) => {
        const items = get().items;

        // Single-vendor cart: reject if a different vendor's items already exist.
        if (item.vendorId && items.length > 0) {
          const existingVendor = items[0].vendorId;
          if (existingVendor && existingVendor !== item.vendorId) {
            return {
              status: 'conflict',
              existingVendor: items[0].vendorName,
              newVendor: item.vendorName,
            };
          }
        }

        const key = lineKey(item);
        const existing = items.find((i) => lineKey(i) === key);
        if (existing) {
          set({
            items: items.map((i) =>
              lineKey(i) === key ? { ...i, quantity: i.quantity + qty } : i,
            ),
          });
          return { status: 'incremented' };
        }
        set({ items: [...items, { ...item, quantity: qty }] });
        return { status: 'added' };
      },
      replaceWith: (item, qty = 1) =>
        set({ items: [{ ...item, quantity: qty }] }),
      remove: (productId, variationComboId) => set((s) => {
        const key = lineKey({ productId, variationComboId });
        return { items: s.items.filter((i) => lineKey(i) !== key) };
      }),
      setQty: (productId, qty, variationComboId) =>
        set((s) => {
          const key = lineKey({ productId, variationComboId });
          return {
            items: s.items.map((i) => (lineKey(i) === key ? { ...i, quantity: Math.max(1, qty) } : i)),
          };
        }),
      clear: () => set({ items: [] }),
      total: () => get().items.reduce((sum, i) => sum + i.price * i.quantity, 0),
      vendorId: () => get().items[0]?.vendorId ?? null,
      vendorName: () => get().items[0]?.vendorName ?? null,
    }),
    { name: 'cart' },
  ),
);

/**
 * Convenience wrapper: tries to add; on vendor conflict, asks the user (via window.confirm)
 * whether to replace the cart with the new item. Returns true if something was added.
 */
export function addToCartWithVendorGuard(
  item: Omit<CartItem, 'quantity'>,
  qty = 1,
): boolean {
  const result = useCart.getState().add(item, qty);
  if (result.status !== 'conflict') return true;

  if (typeof window === 'undefined') return false;
  const ok = window.confirm(
    `Your cart already has items from ${result.existingVendor}. Each checkout is paid to a single vendor. Replace cart with items from ${result.newVendor}?`,
  );
  if (!ok) return false;

  useCart.getState().replaceWith(item, qty);
  return true;
}
