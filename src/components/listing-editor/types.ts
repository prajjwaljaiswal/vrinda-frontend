// Shared types for the listing editor wizard. Phase 1: fields not yet in the
// schema are kept here as UI-only state (held in localStorage so vendors don't
// lose them across reloads) and stripped before submitting to /api/products.

export type WhoMade = 'I_DID' | 'TEAM' | 'ANOTHER_COMPANY' | '';
export type WhatIsIt = 'FINISHED' | 'SUPPLY' | '';
export type WhenMade =
  | 'made_to_order' | '2020s' | '2010s' | '2000s'
  | 'before_2000' | 'vintage' | '';
export type ItemType = 'PHYSICAL' | 'DIGITAL';
export type RenewalMode = 'AUTOMATIC' | 'MANUAL';

// Variations: client-side ids (`tempId`) link options to combos before they
// have real db ids. The backend re-issues real UUIDs at create time.
export interface DraftVariationOption { tempId: string; value: string }
export interface DraftVariation { tempId: string; name: string; options: DraftVariationOption[] }
export interface DraftCombo { optionTempIds: string[]; price: string; stock: string; sku: string }

export interface ListingDraft {
  // Photo & Video
  files: File[];                 // not serialized — re-picked each session
  existingImages: string[];      // already-uploaded image URLs (edit mode)
  // Category
  itemType: ItemType;
  whenMade: WhenMade;
  categoryId: string;
  // Item details
  title: string;
  description: string;
  metalType: string;
  attrValues: Record<string, string>;
  // Item options
  tags: string[];
  personalization: { enabled: boolean; instructions: string; charLimit: number };
  variations: DraftVariation[];
  combos: DraftCombo[];
  // Pricing & shipping
  price: string;
  stockQuantity: string;
  acceptsOffers: boolean;
  sku: string;
  shippingMethodId: string;
  // How it's made (UI only Phase 1)
  whoMade: WhoMade;
  whatIsIt: WhatIsIt;
  // Settings
  shopSection: string;       // VendorSection.id
  returnPolicyId: string;    // VendorReturnPolicy.id
  featured: boolean;
  renewalMode: RenewalMode;
}

export const EMPTY_DRAFT: ListingDraft = {
  files: [],
  existingImages: [],
  itemType: 'PHYSICAL',
  whenMade: '',
  categoryId: '',
  title: '',
  description: '',
  metalType: 'gold',
  attrValues: {},
  tags: [],
  personalization: { enabled: false, instructions: '', charLimit: 256 },
  variations: [],
  combos: [],
  price: '',
  stockQuantity: '1',
  acceptsOffers: false,
  sku: '',
  shippingMethodId: '',
  whoMade: '',
  whatIsIt: '',
  shopSection: '',
  returnPolicyId: '',
  featured: false,
  renewalMode: 'AUTOMATIC',
};

export type StepId = 'media' | 'category' | 'details' | 'options' | 'pricing' | 'made' | 'settings';

export const STEPS: { id: StepId; label: string; hint: string }[] = [
  { id: 'media',    label: 'Photo & Video',     hint: 'Up to 6 photos' },
  { id: 'category', label: 'Category',          hint: 'Where it lives' },
  { id: 'details',  label: 'Item Details',      hint: 'Title & description' },
  { id: 'options',  label: 'Item Options',      hint: 'Tags & extras' },
  { id: 'pricing',  label: 'Pricing & Shipping',hint: 'Price, stock, ship' },
  { id: 'made',     label: "How It's Made",     hint: 'Origin' },
  { id: 'settings', label: 'Settings',          hint: 'Visibility' },
];

// Per-step completion. Used to show checkmarks and to gate Publish.
export function stepStatus(d: ListingDraft): Record<StepId, { complete: boolean; reason?: string }> {
  return {
    media:    d.files.length + d.existingImages.length > 0
                ? { complete: true }
                : { complete: false, reason: 'Add at least one photo' },
    category: d.categoryId && d.whenMade
                ? { complete: true }
                : { complete: false, reason: 'Pick a category and when it was made' },
    details:  d.title.trim().length >= 5 && d.description.trim().length >= 10
                ? { complete: true }
                : { complete: false, reason: 'Title (5+) and description (10+) needed' },
    options:  { complete: true }, // entirely optional
    pricing:  Number(d.price) > 0 && Number(d.stockQuantity) >= 0
                ? { complete: true }
                : { complete: false, reason: 'Price and stock required' },
    made:     d.whoMade && d.whatIsIt
                ? { complete: true }
                : { complete: false, reason: 'Tell us who made it and what it is' },
    settings: { complete: true },
  };
}

export function canPublish(d: ListingDraft): boolean {
  const s = stepStatus(d);
  return s.media.complete && s.category.complete && s.details.complete && s.pricing.complete && s.made.complete;
}
