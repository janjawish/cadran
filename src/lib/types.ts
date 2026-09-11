export type Condition = "excellent" | "good" | "fair" | "poor" | "unknown";
export type Presence = "yes" | "no" | "unknown";
export interface CatalogWatch {
  id: string;
  brand: string;
  collection: string;
  model: string;
  reference: string;
  variant: string;
  diameter: number;
  material: string;
  dial: string;
  movement: string;
  complications: string[];
  bracelet: string;
  period: string;
  image: string;
}
export interface Candidate {
  catalogId?: string;
  brand: string;
  model: string;
  reference: string;
  confidence: number;
  reasons: string[];
}
export interface VisualFeature {
  area: string;
  observation: string;
  status: "observed" | "uncertain" | "not-visible";
}
export interface Identification {
  candidates: Candidate[];
  features: VisualFeature[];
  anomalies: string[];
  missing: string[];
  source: "demo" | "manual" | "ai";
  summary: string;
}
export interface Watch extends CatalogWatch {
  createdAt: number;
  updatedAt: number;
  photoIds: string[];
  identification: Identification;
  condition: Condition;
  box: Presence;
  papers: Presence;
  year?: number;
  favorite: boolean;
  demo: boolean;
}
export interface Photo {
  id: string;
  blob: Blob;
  angle: string;
  createdAt: number;
}
export interface Scan {
  id: string;
  watchId: string;
  createdAt: number;
  type: "scan";
}
export interface ListingInput {
  title: string;
  text: string;
  url: string;
  price?: number;
  year?: number;
  condition: Condition;
  box: Presence;
  papers: Presence;
  service: string;
  seller: string;
}
export interface Listing extends ListingInput {
  id: string;
  watchId: string;
  createdAt: number;
  type: "listing";
  positives: string[];
  inconsistencies: string[];
  missing: string[];
  questions: string[];
}
export interface CollectionItem {
  id: string;
  watchId: string;
  purchasePrice?: number;
  purchaseDate: string;
  serial: string;
  notes: string;
  serviceHistory: { date: string; description: string; cost?: number }[];
  addedAt: number;
  alertBelow?: number;
  alertTriggeredAt?: number;
}
export interface PriceSnapshot {
  id: string;
  watchId: string;
  reference?: string;
  at: number;
  low: number;
  mid: number;
  high: number;
  source: string;
  demo: boolean;
}
export type ProviderId =
  "demo" | "gemini" | "openai" | "anthropic" | "custom" | "bridge";
export interface AISettings {
  id: string;
  provider: ProviderId;
  model: string;
  apiKey: string;
  endpoint: string;
}
export interface Preferences {
  id: string;
  mode: "simple" | "expert";
  initialized: boolean;
  onboardingDismissed: boolean;
}
export interface MarketComparable {
  reference: string;
  price: number;
  currency: "EUR";
  observedAt: string;
  source: string;
  kind: "demo" | "sold" | "asking";
  condition: Condition;
  box: Presence;
  papers: Presence;
}
export interface Estimate {
  available: boolean;
  low: number;
  mid: number;
  high: number;
  approximate: boolean;
  demo: boolean;
  source: string;
  observedAt?: string;
  sampleSize: number;
  factors: { label: string; amount: number }[];
  caveats: string[];
}
export interface DealScore {
  total: number;
  conclusion: string;
  parts: {
    label: string;
    score: number;
    weight: number;
    explanation: string;
  }[];
}
export interface GeneratedListing {
  title: string;
  shortDescription: string;
  description: string;
  characteristics: string[];
  suggestedPrice?: number;
  toSpecify: string[];
}
