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

/** Nested on ListingsRead — listing’s assigned agent (public contact fields). */
export type ApiListingAgentSummary = {
  id: string;
  name: string;
  phone: string;
  email: string;
};

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
  /** Present on current API; omitted on older backends. */
  agent?: ApiListingAgentSummary | null;
};

export type ListingSearchParams = {
  city?: string;
  province_state?: string;
  country?: string;
  market?: string;
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
// Saved listings
// ---------------------------------------------------------------------------

/** Header used with anonymous session token (see GET /saved_listings/mine). */
export const ANONYMOUS_SESSION_HEADER = 'X-Anonymous-Session-Token';

export type SavedListingCheckRead = {
  saved: boolean;
  saved_listing_id: string | null;
};

export type SavedListingsRead = {
  id: string;
  user_id: string | null;
  listing_id: string;
  session_token: string | null;
  created_at: string;
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

/** Mirrors `users.role` in lucy-charm-api */
export type UserRole = 'client' | 'agent' | 'superadmin';

/** Mirrors UserRead from GET /users/me */
export type UserMe = {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  security_stamp: string;
  created_at: string;
  updated_at: string;
  is_anonymous: boolean;
  last_active_at: string;
  session_token: string;
  role: UserRole;
};

/** Stored user info (persisted in localStorage alongside tokens) */
export type AuthUser = {
  user_id: string;
  email: string;
  first_name: string;
  last_name: string;
  /** May be absent briefly after upgrade until `AuthHydrator` runs GET /users/me */
  role?: UserRole;
};

/** Maps API UserMe → AuthUser for the Zustand store */
export function userMeToAuthUser(me: UserMe): AuthUser {
  return {
    user_id: me.id,
    email: me.email,
    first_name: me.first_name,
    last_name: me.last_name,
    role: me.role,
  };
}

// ---------------------------------------------------------------------------
// Agent portal
// ---------------------------------------------------------------------------

/** Mirrors AgentRead from GET /agents/me */
export type AgentProfile = {
  id: string;
  email: string;
  user_id: string;
  name: string;
  phone: string;
  license_number: string;
  created_at: string;
  updated_at: string;
};

/** Mirrors ClientIntentSummary from listing insights API */
export type ClientIntentSummary = {
  user_id: string;
  first_name: string;
  last_name: string;
  email: string;
  session_id: string;
  current_intent: string;
  confidence: number;
  intent_last_seen: string;
  intent_change_count: number;
  latest_summary: string | null;
  summary_created_at: string | null;
};

export type ClientIntentListResponse = {
  listing_id: string;
  listing_title: string;
  total: number;
  items: ClientIntentSummary[];
};

/** Backend PaginatedItems uses `page_size` */
export type ApiPaginated<T> = {
  items: T[];
  total: number;
  page: number;
  page_size: number;
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

/** Mirrors AiMessagesRead (persisted chat rows; not the lightweight ChatMessage UI type). */
export type AiMessageRecord = {
  id: string;
  session_id: string;
  listing_id: string | null;
  role: string;
  message_text: string;
  confidence_score: number | null;
  source_data: Record<string, unknown> | null;
  model_version: string | null;
  escalation_flag: boolean;
  created_at: string;
  updated_at: string;
};

// ---------------------------------------------------------------------------
// Superadmin portal
// ---------------------------------------------------------------------------

/** Mirrors LeadsRead */
export type LeadRead = {
  id: string;
  user_id: string | null;
  anonymous_session_id: string | null;
  listing_id: string | null;
  assigned_agent_id: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  lead_type: string;
  lead_temperature: string;
  lead_score: number;
  source: string | null;
  primary_intent: string | null;
  intent_confidence: number | null;
  latest_summary: string | null;
  first_agent_touch_at: string | null;
  hubspot_contact_id: string | null;
  hubspot_synced_at: string | null;
  created_at: string;
  updated_at: string;
};

export type SuperadminNamedCount = {
  key: string;
  count: number;
};

export type SuperadminFunnelStage = {
  event_type: string;
  count: number;
};

export type SuperadminListingEngagement = {
  listing_id: string;
  engagement_events: number;
};

export type SuperadminHandoffTiming = {
  sample_size: number;
  avg_seconds_to_assign: number | null;
  min_seconds_to_assign: number | null;
  max_seconds_to_assign: number | null;
};

/** Mirrors SuperadminDashboardSummary from GET /superadmin/insights/dashboard */
export type SuperadminDashboardSummary = {
  top_intent_types: SuperadminNamedCount[];
  lead_funnel_by_stage: SuperadminFunnelStage[];
  cta_event_counts: SuperadminNamedCount[];
  top_listings_by_engagement: SuperadminListingEngagement[];
  handoff_timing: SuperadminHandoffTiming;
};

export type LeadInternalNoteRead = {
  id: string;
  lead_id: string;
  author_user_id: string;
  body: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
};

export type LeadTagRead = {
  id: string;
  lead_id: string;
  tag_label: string;
  created_by_user_id: string;
  created_at: string;
  deleted_at?: string | null;
};

// ---------------------------------------------------------------------------
// Chat
// ---------------------------------------------------------------------------

/** Mirrors ChatSendRequest */
export type ChatSendRequest = {
  session_id: string;
  message_text: string;
  listing_id?: string;
  /** Browser URL from which the message was sent — stored for the audit log. */
  page_url?: string;
};

/** Mirrors ChatSendResponse */
export type ChatSendResponse = {
  reply_text: string;
  intent: string | null;
  escalation_flag: boolean;
  confidence_score: number | null;
  /** Listing fields that were injected into the prompt context (trust layer). */
  listing_fields_used: string[] | null;
  model_version: string | null;
  prompt_version: string | null;
};

export type ChatRequestHumanResponse = {
  status: string;
  escalation_id: string;
};

// ---------------------------------------------------------------------------
// Showing requests
// ---------------------------------------------------------------------------

export type ShowingRequestStatus = 'pending' | 'confirmed' | 'rescheduled' | 'cancelled' | 'completed';
export type ShowingType = 'in_person' | 'virtual' | 'open_house';

/** Mirrors ShowingRequestRead from the API */
export type ShowingRequest = {
  id: string;
  user_id: string | null;
  listing_id: string;
  agent_id: string | null;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  showing_type: ShowingType;
  preferred_date: string;
  alternate_date: string | null;
  duration_minutes: number;
  message: string | null;
  lead_type: string | null;
  is_pre_approved: boolean;
  financing_notes: string | null;
  referral_source: string | null;
  status: ShowingRequestStatus;
  confirmed_at: string | null;
  agent_notes: string | null;
  crm_synced: boolean;
  created_at: string;
  updated_at: string;
};

/** Mirrors ShowingRequestCreate body */
export type ShowingRequestCreate = {
  listing_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  showing_type: ShowingType;
  preferred_date: string; // ISO datetime
  alternate_date?: string;
  duration_minutes?: number;
  message?: string;
  lead_type?: string;
  is_pre_approved?: boolean;
  financing_notes?: string;
  referral_source?: string;
  /** Optional Lucy chat session — attaches conversation context to HubSpot. */
  ai_session_id?: string;
};

/** Mirrors ShowingRequestUpdate body */
export type ShowingRequestUpdate = {
  status?: ShowingRequestStatus;
  confirmed_at?: string;
  agent_notes?: string;
  alternate_date?: string;
  crm_synced?: boolean;
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
  listing_fields_used?: string[] | null;
  model_version?: string | null;
  prompt_version?: string | null;
  escalation_flag?: boolean;
};
