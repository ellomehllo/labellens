// Types and constants shared by the browser app and the API server.

export const CATEGORIES = ['food', 'cosmetics', 'oral_care', 'cleaner', 'supplement', 'other'] as const;
export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_LABELS: Record<Category, string> = {
  food: 'Food & drink',
  cosmetics: 'Cosmetics & skincare',
  oral_care: 'Oral care',
  cleaner: 'Household cleaner',
  supplement: 'Supplement',
  other: 'Other / not sure',
};

export const SECTION_KINDS = [
  'product_name',
  'brand',
  'ingredients',
  'allergens',
  'nutrition',
  'directions',
  'warnings',
  'storage',
  'dates',
  'net_quantity',
  'claims',
  'manufacturer',
  'other',
] as const;
export type SectionKind = (typeof SECTION_KINDS)[number];

export const SECTION_LABELS: Record<SectionKind, string> = {
  product_name: 'Product name',
  brand: 'Brand',
  ingredients: 'Ingredients',
  allergens: 'Allergens',
  nutrition: 'Nutrition / amounts',
  directions: 'Directions',
  warnings: 'Warnings',
  storage: 'Storage',
  dates: 'Dates',
  net_quantity: 'Net quantity',
  claims: 'Claims',
  manufacturer: 'Manufacturer',
  other: 'Other text',
};

/** Fields where a misread changes what the label means; the review screen asks users to check these. */
export const CRITICAL_KINDS: ReadonlySet<SectionKind> = new Set([
  'ingredients',
  'allergens',
  'nutrition',
  'directions',
  'warnings',
  'dates',
  'net_quantity',
]);

export const MARKETS = [
  { id: 'US', label: 'United States' },
  { id: 'CA', label: 'Canada' },
  { id: 'EU', label: 'European Union' },
  { id: 'UK', label: 'United Kingdom' },
  { id: 'IN', label: 'India' },
  { id: 'AU', label: 'Australia / New Zealand' },
  { id: 'other', label: 'Somewhere else' },
] as const;

export const CONFIDENCE = ['high', 'medium', 'low'] as const;
export type Confidence = (typeof CONFIDENCE)[number];

export type InputKind = 'photo' | 'typed' | 'example';

export interface LabelSection {
  id: string;
  kind: SectionKind;
  text: string;
  /** How sure the reader was about this text. Null for text the user typed. */
  confidence: Confidence | null;
  uncertain: string[];
  edited: boolean;
}

export interface Extraction {
  readability: 'good' | 'fair' | 'poor';
  image_issues: string[];
  not_a_label: boolean;
  sections: LabelSection[];
  category: Category;
  category_confidence: Confidence;
  market: string | null;
  market_basis: string | null;
  notes: string[];
}

export const FINDING_TYPES = ['label_fact', 'interpretation', 'verified_claim', 'unverified'] as const;
export type FindingType = (typeof FINDING_TYPES)[number];

export const RELEVANCE = ['informational', 'precaution', 'urgent_label_warning'] as const;
export type Relevance = (typeof RELEVANCE)[number];

export interface Evidence {
  source_id: string;
  title: string;
  publisher: string;
  url: string;
  jurisdiction: string;
  published_or_updated_at: string | null;
  retrieved_at: string;
  /** The specific statement from the source that the claim relies on. */
  supports_claim: string;
}

export interface Finding {
  id: string;
  title: string;
  explanation: string;
  type: FindingType;
  relevance: Relevance;
  confidence: Confidence | null;
  label_quote: string | null;
  limitations: string[];
  evidence: Evidence[];
  why_unverified: string | null;
}

export interface IngredientGroup {
  group: string;
  items: { name: string; explanation: string; confidence: Confidence }[];
}

export interface Analysis {
  product: { name: string | null; brand: string | null; category: Category; market: string | null };
  summary: string;
  category_note: string | null;
  label_facts: { field: string; value: string }[];
  findings: Finding[];
  ingredient_groups: IngredientGroup[];
  unreadable_or_missing: string[];
  overall_limitations: string[];
  next_steps: string[];
  meta: {
    model: string;
    analyzed_at: string;
    input: InputKind;
    readability: Extraction['readability'] | null;
    safety_edits: number;
    dropped_references: number;
  };
}

export interface AnalyzeRequest {
  sections: Pick<LabelSection, 'kind' | 'text' | 'confidence' | 'edited'>[];
  category: Category;
  market: string | null;
  input: InputKind;
  readability: Extraction['readability'] | null;
}

export interface SourcePoint {
  id: string;
  text: string;
}

export interface Source {
  id: string;
  title: string;
  publisher: string;
  url: string;
  jurisdiction: string;
  categories: Category[];
  /** Date shown on the page itself, if it shows one. */
  updated: string | null;
  /** Date we last read the page and checked the points below. */
  checked: string;
  points: SourcePoint[];
}

export interface ServiceStatus {
  ai: boolean;
  model: string;
  sources: number;
  limits: { maxImages: number; maxImageBytes: number };
}

export type StreamEvent<T> =
  | { stage: string }
  | { result: T }
  | { error: { code: string; message: string } };

export const LIMITS = {
  maxImages: 4,
  maxImageBytes: 5 * 1024 * 1024,
  maxSections: 30,
  maxSectionChars: 6000,
  maxTotalChars: 20000,
} as const;
