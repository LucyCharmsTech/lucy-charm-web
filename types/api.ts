/**
 * TypeScript types that mirror the FastAPI backend response schemas.
 * Keep in sync with lucy-charm-api/app/api/listings/models.py and related files.
 */

// ---------------------------------------------------------------------------
// Shared
// ---------------------------------------------------------------------------

export type PaginatedItems<T> = {
  items: T[];
  total: number;
  page: number;
  size: number;
  pages: number;
};

// ---------------------------------------------------------------------------
// Listings
// ---------------------------------------------------------------------------

/** Mirrors ListingsRead in lucy-charm-api */
export type ApiListing = {
  id: string; // UUID
  source_system: string;
  source_id: string | null;
  status: string;
  market: string;
  currency: string;
  property_type: string | null;
  title: string;
  description: string | null;
  price: number;
  beds: number | null;
  baths: number | null;
  sqft: number | null;
  lot_size: number | null;
  year_built: number | null;
  parking_spaces: number | null;
  taxes: number | null;
  hoa_fee: number | null;
  address: string;
  unit: string | null;
  city: string;
  state: string;
  zip: string;
  country: string;
  display_address: string | null;
  latitude: number | null;
  longitude: number | null;
  primary_image_url: string | null;
  virtual_tour_url: string | null;
  ai_summary: string | null;
  source_attribution: string | null;
  source_disclaimer: string | null;
  last_updated_at: string | null;
  agent_id: string;
  created_at: string;
  updated_at: string;
};

export type ListingSearchParams = {
  city?: string;
  province_state?: string;
  property_type?: string;
  status?: string;
  price_min?: number;
  price_max?: number;
  beds_min?: number;
  baths_min?: number;
  sqft_min?: number;
  sqft_max?: number;
  sort_by?: string;
  sort_order?: string;
  page?: number;
  size?: number;
};

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

/** Mirrors Token response from POST /auth/login */
export type AuthToken = {
  access_token: string;
  refresh_token: string;
  token_type: string;
};

/** Mirrors SignupRequest body for POST /auth/signup */
export type SignupRequest = {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
};

/** Mirrors SignupResponse from POST /auth/signup */
export type SignupResponse = {
  user_id: string;
  email: string;
  first_name: string;
  last_name: string;
};

/** Stored user info (persisted in localStorage alongside tokens) */
export type AuthUser = {
  user_id: string;
  email: string;
  first_name: string;
  last_name: string;
};

// ---------------------------------------------------------------------------
// AI Sessions
// ---------------------------------------------------------------------------

/** Mirrors AiSessionsRead */
export type AiSession = {
  id: string;
  user_id: string | null;
  session_token: string | null;
  created_at: string;
  updated_at: string;
};

// ---------------------------------------------------------------------------
// Chat
// ---------------------------------------------------------------------------

/** Mirrors ChatSendRequest */
export type ChatSendRequest = {
  session_id: string;
  message_text: string;
  listing_id?: string;
};

/** Mirrors ChatSendResponse */
export type ChatSendResponse = {
  reply_text: string;
  intent: string | null;
  escalation_flag: boolean;
  confidence_score: number | null;
};

// Roles used in the local chat message list
export type ChatRole = 'user' | 'assistant';

export type ChatMessage = {
  id: string;
  role: ChatRole;
  text: string;
  timestamp: Date;
  /** Populated on assistant messages from `ChatSendResponse` */
  confidence_score?: number | null;
};
