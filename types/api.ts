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
  page_size: number;
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

export type ApiIdxAgentSummary = {
  member_key: string;
  member_mls_id: string | null;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  preferred_phone: string | null;
  direct_phone: string | null;
  mobile_phone: string | null;
  office_phone: string | null;
  office_phone_ext: string | null;
  member_status: string | null;
  member_type: string | null;
  state_license: string | null;
  office_key: string | null;
};

export type ApiIdxOfficeSummary = {
  office_key: string;
  office_mls_id: string | null;
  office_name: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  province: string | null;
  postal_code: string | null;
};

export type ApiListingMedia = {
  id: string;
  media_url: string;
  media_type: string | null;
  media_category: string | null;
  display_order: number;
  caption: string | null;
  is_primary: boolean;
};

/** Mirrors ListingsRead in lucy-charm-api */
export type ApiListing = {
  id: string; // UUID
  source_system: string;
  source_id: string | null;
  mls_number: string | null;
  status: string;
  market: string;
  currency: string;
  property_type: string | null;
  /** RESO PropertySubType — "Detached", "Condo Apartment", "Locker", "Office". */
  property_subtype: string | null;
  /** "For Sale" / "For Lease". */
  transaction_type: string | null;
  /** Denominator the price is quoted in ("Month", "Sq Ft Net", "Per Acre"). */
  price_unit: string | null;
  standard_status: string | null;
  mls_status: string | null;
  contract_status: string | null;
  title: string;
  description: string | null;
  price: number;
  beds: number | null;
  baths: number | null;
  sqft: number | null;
  lot_size: number | null;
  lot_size_units: string | null;
  lot_size_range: string | null;
  building_area_units: string | null;
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
  /** NULL means the feed stated no preference; only an explicit false opts out. */
  is_internet_displayable: boolean | null;
  is_address_displayable: boolean | null;
  last_updated_at: string | null;
  original_entry_at: string | null;
  source_modified_at: string | null;
  system_modified_at: string | null;
  media_changed_at: string | null;
  photos_changed_at: string | null;
  last_seen_at: string | null;
  is_feed_managed: boolean;
  agent_id: string | null;
  created_at: string;
  updated_at: string;
  /** Present on current API; omitted on older backends. */
  agent?: ApiListingAgentSummary | null;
  idx_member_key: string | null;
  idx_office_key: string | null;
  /** Brokerage name as it arrived on the listing record; display obligation. */
  idx_office_name: string | null;
  neighbourhood: string | null;
  cross_street: string | null;
  directions: string | null;
  cooling: string | null;
  heating_type: string | null;
  garage_type: string | null;
  sewer: string | null;
  basement: string | null;
  has_basement: boolean | null;
  property_features: string | null;
  lot_width: number | null;
  lot_depth: number | null;
  tax_year: number | null;
  kitchens: number | null;
  /** YearBuilt is never populated on this feed; this is a band ("6-15", "New"). */
  approximate_age: string | null;
  idx_agent?: ApiIdxAgentSummary | null;
  idx_office?: ApiIdxOfficeSummary | null;
};

export type ListingSearchParams = {
  city?: string;
  province_state?: string;
  country?: string;
  market?: string;
  property_type?: string;
  property_types?: string[];
  titles?: string[];
  status?: string;
  price_min?: number;
  price_max?: number;
  beds_min?: number;
  baths_min?: number;
  sqft_min?: number;
  sqft_max?: number;
  /**
   * Map viewport bounds. Sent only from map view; listings whose coordinates
   * are withheld (address suppressed by the board) can never match these, which
   * is why the map reports how many results it cannot place.
   */
  lat_min?: number;
  lat_max?: number;
  lng_min?: number;
  lng_max?: number;
  /**
   * `false` asks for the listings a map can never place — the board suppressed
   * the address, so there are no coordinates. The map view counts them so they
   * are reported rather than silently missing from the result total.
   */
  has_coordinates?: boolean;
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

export type MagicLinkRequestBody = {
  email: string;
  redirect_path?: string;
  /** Signup only — required on /register, omitted on /login. */
  full_name?: string;
};

export type MagicLinkRequestResponse = {
  detail: string;
};

export type AccountRecoveryRequestBody = {
  email: string;
  redirect_path?: string;
};

export type InactiveAccountDetails = {
  code: 'ACCOUNT_INACTIVE';
  status: 'deleted' | 'deactivated';
  recoverable: boolean;
  message: string;
  recovery_window_days?: number;
};

export type MagicLinkVerifyBody = {
  token: string;
};

/** Mirrors `users.role` in lucy-charm-api */
export type UserRole = 'client' | 'agent' | 'superadmin';

/** Mirrors UserRead from GET /users/me */
export type UserMe = {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  created_at: string;
  updated_at: string;
  is_anonymous: boolean;
  last_active_at: string;
  role: UserRole;
  onboarding_completed: boolean;
  onboarding_completed_at: string | null;
  deactivated_at: string | null;
  marketing_emails_enabled: boolean;
  listing_alerts_enabled: boolean;
  product_updates_enabled: boolean;
};

export type UserPrivacyPreferences = {
  marketing_emails_enabled: boolean;
  listing_alerts_enabled: boolean;
  product_updates_enabled: boolean;
};

export type UserDataRequestType =
  'access' | 'correction' | 'deletion' | 'portability';

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
// Signup onboarding
// ---------------------------------------------------------------------------

export type OnboardingPrimaryIntent =
  'buyer' | 'seller' | 'investor' | 'exploring';
export type OnboardingTimeline =
  'asap' | '1_3_months' | '3_6_months' | '6_plus_months';
export type OnboardingPropertyType =
  'house' | 'condo' | 'townhome' | 'multi_family' | 'other';
export type OnboardingFinancingStatus =
  'pre_approved' | 'not_yet' | 'cash' | 'prefer_not_to_say';
export type OnboardingMainPriority =
  'price' | 'location' | 'size' | 'schools' | 'investment' | 'lifestyle';

export type UserOnboardingSubmitRequest = {
  primary_intent?: OnboardingPrimaryIntent;
  timeline: OnboardingTimeline;
  preferred_country: string;
  preferred_city: string;
  property_types: OnboardingPropertyType[];
  budget_min?: number;
  budget_max?: number;
  min_bedrooms?: number;
  min_bathrooms?: number;
  parking_required?: boolean;
  financing_status?: OnboardingFinancingStatus;
  main_priorities?: OnboardingMainPriority[];
  wants_listing_alerts: boolean;
};

export type UserOnboardingRead = {
  completed: boolean;
  completed_at: string | null;
  responses: Record<string, unknown> | null;
};

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

/** Mirrors AgentShowingResponseStats from GET /agents/me/insights */
export type AgentShowingResponseStats = {
  confirmed_count: number;
  avg_seconds_to_confirm: number | null;
  min_seconds_to_confirm: number | null;
  max_seconds_to_confirm: number | null;
};

/** Mirrors AgentInsightsResponse from GET /agents/me/insights */
export type AgentInsightsResponse = {
  agent_id: string;
  showings: AgentShowingResponseStats;
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

/** Pipeline stages — mirrors LeadStage constants; changed by hand only. */
export type LeadStage =
  | 'new'
  | 'contacted'
  | 'qualified'
  | 'appointment'
  | 'active'
  | 'offer'
  | 'closed'
  | 'lost';

export const LEAD_STAGES: readonly LeadStage[] = [
  'new',
  'contacted',
  'qualified',
  'appointment',
  'active',
  'offer',
  'closed',
  'lost',
] as const;

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
  status: LeadStage;
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

/** Mirrors PipelineStageCount — where leads sit now, not events that happened */
export type SuperadminPipelineStage = {
  status: LeadStage;
  count: number;
};

/** Mirrors PipelineSummary */
export type SuperadminPipelineSummary = {
  total_leads: number;
  unassigned_leads: number;
  by_stage: SuperadminPipelineStage[];
};

/** Mirrors SuperadminDashboardSummary from GET /superadmin/insights/dashboard */
export type SuperadminDashboardSummary = {
  top_intent_types: SuperadminNamedCount[];
  lead_funnel_by_stage: SuperadminFunnelStage[];
  cta_event_counts: SuperadminNamedCount[];
  top_listings_by_engagement: SuperadminListingEngagement[];
  handoff_timing: SuperadminHandoffTiming;
  pipeline: SuperadminPipelineSummary;
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
  email?: string;
  listing_id?: string;
  /** Private Seller Journey context; activates the Seller Journey compliance gate. */
  seller_journey_id?: string;
  /** Browser URL from which the message was sent — stored for the audit log. */
  page_url?: string;
};

/** Mirrors ChatSendResponse */
export type ChatPlaceCard = {
  listing_id: string;
  title: string;
  city: string;
  state: string;
  price: number;
  currency: string;
  beds: number | null;
  baths: number | null;
  sqft: number | null;
  property_type: string | null;
  primary_image_url: string | null;
  display_address: string | null;
};

export type ChatSendResponse = {
  reply_text: string;
  intent: string | null;
  query_route?: string | null;
  escalation_flag: boolean;
  confidence_score: number | null;
  /** Listing fields that were injected into the prompt context (trust layer). */
  listing_fields_used: string[] | null;
  model_version: string | null;
  prompt_version: string | null;
  /** Optional UI actions requested by the server (safe, whitelisted strings). */
  ui_actions?: string[] | null;
  /** Optional listing cards for search-like responses. */
  place_cards?: ChatPlaceCard[] | null;
  response_type:
    | 'general_information'
    | 'professional_advice'
    | 'clarification'
    | 'data_unavailable';
  assumptions: string[];
  sources: ChatResponseSource[];
};

export type ChatResponseSource = {
  source_type: string;
  label: string;
  as_of: string | null;
  verification_url: string | null;
};

export type ChatRequestHumanResponse = {
  status: string;
  escalation_id: string;
};

// ---------------------------------------------------------------------------
// Showing requests
// ---------------------------------------------------------------------------

export type ShowingRequestStatus =
  'pending' | 'confirmed' | 'rescheduled' | 'cancelled' | 'completed';
export type ShowingType = 'in_person' | 'virtual' | 'open_house';
export type ShowingIdVerificationStatus =
  'not_requested' | 'pending' | 'verified';
export type ShowingFeedbackInterestLevel = 'low' | 'medium' | 'high';
export type ShowingFeedbackPriceFit =
  'below_budget' | 'on_target' | 'above_budget';

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
  id_verification_requested: boolean;
  id_verification_status: ShowingIdVerificationStatus;
  id_verification_notes: string | null;
  /** True when an uploaded/verified ID file exists for this request. */
  identity_document_uploaded: boolean;
  status: ShowingRequestStatus;
  confirmed_at: string | null;
  scheduled_at: string | null;
  rescheduled_at: string | null;
  agent_notes: string | null;
  crm_synced: boolean;
  feedback_submitted_at: string | null;
  feedback_rating: number | null;
  feedback_interest_level: ShowingFeedbackInterestLevel | null;
  feedback_price_fit: ShowingFeedbackPriceFit | null;
  feedback_comment: string | null;
  feedback_would_offer: boolean | null;
  feedback_ai_profile_consent: boolean;
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
  id_verification_requested?: boolean;
  /** Optional Lucy chat session — attaches conversation context to HubSpot. */
  ai_session_id?: string;
};

/** Mirrors ShowingRequestUpdate body */
export type ShowingRequestUpdate = {
  agent_id?: string | null;
  status?: ShowingRequestStatus;
  confirmed_at?: string;
  scheduled_at?: string;
  agent_notes?: string;
  alternate_date?: string;
  crm_synced?: boolean;
  id_verification_status?: ShowingIdVerificationStatus;
  id_verification_notes?: string;
};

/** Mirrors ShowingRequestFeedbackSubmit body */
export type ShowingRequestFeedbackSubmit = {
  feedback_rating: number;
  feedback_interest_level: ShowingFeedbackInterestLevel;
  feedback_price_fit: ShowingFeedbackPriceFit;
  feedback_comment?: string;
  feedback_would_offer?: boolean;
  feedback_ai_profile_consent?: boolean;
};

// ---------------------------------------------------------------------------
// Document centre (/api/v1/documents)
// ---------------------------------------------------------------------------

export type DocumentStatus =
  | 'requested' // asked for; no file yet
  | 'missing' // staff gave up waiting; a late upload is still accepted
  | 'uploaded' // file received, not yet decided
  | 'under_review' // a reviewer has opened it
  | 'accepted'
  | 'rejected'
  | 'replacement_needed' // legitimate but unusable — send a fresh copy
  | 'expired' // passed its own expires_at
  | 'superseded'; // replaced by a newer version; history

export type DocumentCategory =
  | 'identity' // the only one in use at launch
  | 'proof_of_funds'
  | 'pre_approval'
  | 'other';

export type DocumentVisibility = 'client_visible' | 'internal_only';
export type DocumentScanStatus =
  'pending' | 'clean' | 'infected' | 'error' | 'skipped';
export type DocumentResourceType =
  'showing_request' | 'user' | 'seller_transaction';
export type DocumentReviewOutcome =
  'accepted' | 'rejected' | 'replacement_needed';

/**
 * What the document's owner sees. All file fields are null while status is
 * `requested` or `missing` — a document row can exist with no file.
 */
export type ClientDocument = {
  id: string;
  resource_type: DocumentResourceType;
  resource_id: string;
  category: DocumentCategory;
  description: string | null;
  original_filename: string | null;
  content_type: string | null;
  size_bytes: number | null;
  status: DocumentStatus;
  version: number;
  supersedes_document_id: string | null;
  superseded_by_document_id: string | null;
  /** When the DOCUMENT stops being valid (e.g. an ID card's own expiry). */
  expires_at: string | null;
  /** Advisory only — nothing happens server-side when it passes. */
  due_date: string | null;
  reviewed_at: string | null;
  /** Why it was rejected / why a replacement is needed. Safe to show the client. */
  client_reason: string | null;
  created_at: string;
  updated_at: string;
};

/** What a managing agent or superadmin sees. Superset of ClientDocument. */
export type StaffDocument = ClientDocument & {
  owner_user_id: string;
  uploaded_by_user_id: string;
  visibility: DocumentVisibility;
  checksum_sha256: string | null;
  scan_status: DocumentScanStatus;
  /** INTERNAL. Never render in a client-facing view. */
  review_note: string | null;
  reviewed_by_user_id: string | null;
  retention_expires_at: string | null;
  purged_at: string | null;
  deleted_at: string | null;
  storage_key: string | null;
};

export type AppDocument = ClientDocument | StaffDocument;

/** Mirrors DocumentAccessUrl — a short-lived signed S3 URL. Never cache it. */
export type DocumentAccessUrl = {
  url: string;
  expires_in: number; // seconds, typically 300
  filename: string;
  content_type: string;
  inline: boolean; // true = renders in-tab, false = downloads
};

export type DocumentAuditEntry = {
  id: string;
  document_id: string;
  actor_user_id: string | null; // null for system actions (expiry, purge)
  action:
    | 'requested'
    | 'uploaded'
    | 'viewed'
    | 'downloaded'
    | 'replaced'
    | 'reviewed'
    | 'deleted'
    | 'expired'
    | 'purged';
  document_status: string | null;
  detail_json: Record<string, unknown> | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
};

export type DocumentHistory = {
  /** Oldest version first. */
  versions: AppDocument[];
  /** Populated for staff only; an empty array for clients, never absent. */
  audit: DocumentAuditEntry[];
};

export type RequestDocumentBody = {
  resource_type: DocumentResourceType;
  resource_id: string;
  category?: DocumentCategory; // defaults to "identity"
  description?: string | null; // ≤1000 chars; shown to the client
  due_date?: string | null; // ISO 8601, must be in the future
};

export type DocumentReviewBody = {
  outcome: DocumentReviewOutcome;
  /** Required unless outcome is "accepted". ≤1000 chars. Shown to the client. */
  client_reason?: string | null;
  /** Staff-only, never shown to the client. ≤2000 chars. */
  review_note?: string | null;
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
  place_cards?: ChatPlaceCard[] | null;
  response_type?: ChatSendResponse['response_type'];
  assumptions?: string[];
  sources?: ChatResponseSource[];
};

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------

/**
 * Event types the API emits today. Deliberately an **open set** — new values ship
 * without a frontend release, so every consumer must handle the default case.
 */
export type NotificationEventType =
  | 'showing.requested'
  | 'showing.confirmed'
  | 'showing.rescheduled'
  | 'report.status_updated'
  | 'document.requested'
  | 'document.reminder'
  | 'document.uploaded'
  | 'document.reviewed'
  | 'document.expired';

/**
 * Mirrors NotificationRead from the API.
 * Named `AppNotification` because `Notification` is a DOM global.
 */
export type AppNotification = {
  id: string;
  /** Widened past `NotificationEventType` on purpose — see the type's note. */
  event_type: NotificationEventType | string;
  /** Always `'transactional'` today, hence a plain string rather than a union. */
  category: string;
  title: string;
  body: string | null;
  /** Relative web-app path, e.g. `/profile?showing=<uuid>` — never an API URL. */
  deep_link: string | null;
  resource_type: string | null;
  resource_id: string | null;
  /** Metadata for badging and filtering only; all display copy is in title/body. */
  payload_json: Record<string, unknown> | null;
  read_at: string | null;
  created_at: string;
  /** Server-computed `read_at !== null`. */
  is_read: boolean;
};

export type NotificationUnreadCount = {
  unread: number;
};

/** Counts only the rows that were actually unread, so a repeat call returns 0. */
export type NotificationMarkAllReadResponse = {
  updated: number;
};

// ---------------------------------------------------------------------------
// Realtime (WebSocket)
// ---------------------------------------------------------------------------

/** Mirrors WsTicketResponse from the API — POST /ws/ticket. */
export type WsTicketResponse = {
  ticket: string;
  expires_in: number;
  url: string;
};

/**
 * Mirrors RealtimeEventType from the API. Open set, like NotificationEventType —
 * the `lead.*` values are reserved by the API but nothing publishes them yet.
 */
export type RealtimeEventType =
  | 'notification.created'
  | 'notification.read'
  | 'notification.read_all'
  | 'notification.dismissed'
  | 'showing.status_changed'
  | 'showing.withdrawn'
  | 'showing.id_verification_changed'
  | 'showing.document_uploaded'
  | 'showing.feedback_submitted'
  | 'listing.created'
  | 'listing.updated'
  | 'listing.deleted'
  | 'lead.assigned'
  | 'lead.status_changed';

/** Mirrors RealtimeEvent from the API — one fan-out unit on the socket. */
export type RealtimeEvent<P = Record<string, unknown>> = {
  v: number;
  /** Dedupe key. The same logical change publishes to several channels with distinct ids. */
  id: string;
  /** Per-channel monotonic counter — lets a reconnect ask for a gap replay. */
  seq: number;
  type: RealtimeEventType | string;
  channel: string;
  occurred_at: string;
  payload: P;
};

export type RealtimeReplayStatus = 'current' | 'replayed' | 'refetch_required';
export type RealtimeRejectReason =
  'not_authorized' | 'unknown_channel' | 'channel_limit';

/** Server → client frames — mirrors ServerMessageType and the shapes in resource.py. */
export type RealtimeServerFrame =
  | {
      type: 'welcome';
      v: number;
      connection_id: string;
      user_id: string;
      channels: string[];
      heartbeat_interval: number;
      max_connection_seconds: number;
    }
  | {
      type: 'subscribed';
      channels: string[];
      rejected: { channel: string; reason: RealtimeRejectReason | string }[];
      replay: Record<string, RealtimeReplayStatus>;
    }
  | { type: 'unsubscribed'; channels: string[]; reason?: string }
  | { type: 'event'; event: RealtimeEvent; replayed?: boolean }
  | { type: 'ping' }
  | { type: 'pong' }
  | { type: 'error'; code: string; message: string };

/** notification.created — the full inbox row plus the recomputed badge count. */
export type NotificationCreatedPayload = {
  notification: AppNotification;
  /** null when the server's recount failed — keep the previous value, never render 0. */
  unread_count: number | null;
};

/** notification.read / notification.read_all / notification.dismissed. */
export type NotificationReadStatePayload = {
  notification_id?: string;
  updated?: number;
  unread_count: number | null;
};

export type ListingCreatedPayload = {
  listing_id: string;
  listing: ApiListing;
};

export type ListingUpdatedPayload = {
  listing_id: string;
  /** Only the columns whose value actually changed — patch these in place. */
  changed: Record<string, unknown>;
  /** The full read model, for when replacing the row is simpler than merging. */
  listing: ApiListing;
};

export type ListingDeletedPayload = {
  listing_id: string;
};

/**
 * Showing payloads carry ids, statuses and non-sensitive fields only — reviewer
 * notes, feedback comments and contact details stay behind the authenticated REST
 * reads, matching the notification-centre redaction rule.
 */
export type ShowingStatusChangedPayload = {
  showing_request_id: string;
  listing_id: string;
  status: ShowingRequestStatus;
  /** null announces a brand-new request (the agent's queue gains a row). */
  previous_status: ShowingRequestStatus | null;
  scheduled_at: string | null;
  previous_scheduled_at?: string | null;
  rescheduled?: boolean;
  id_verification_status?: ShowingIdVerificationStatus;
};

export type ShowingWithdrawnPayload = {
  showing_request_id: string;
  listing_id: string;
  previous_status: ShowingRequestStatus;
};

export type ShowingIdVerificationChangedPayload = {
  showing_request_id: string;
  listing_id: string;
  id_verification_status: ShowingIdVerificationStatus;
  previous_id_verification_status: ShowingIdVerificationStatus;
  document_id?: string;
  /** Legacy identity-flow vocabulary — the document centre uses DocumentStatus. */
  document_status?: 'uploaded' | 'verified' | 'rejected';
  /** Present when the change came from an agent reviewing a document. */
  review_status?: 'verified' | 'rejected';
};

export type ShowingDocumentUploadedPayload = {
  showing_request_id: string;
  listing_id: string;
  document_id: string;
  /** Legacy identity-flow vocabulary — the document centre uses DocumentStatus. */
  document_status: 'uploaded' | 'verified' | 'rejected';
  content_type: string;
  id_verification_status: ShowingIdVerificationStatus;
  previous_id_verification_status: ShowingIdVerificationStatus;
};

/** Structured feedback signal only — `feedback_comment` is deliberately not on the wire. */
export type ShowingFeedbackSubmittedPayload = {
  showing_request_id: string;
  listing_id: string;
  feedback_submitted_at: string | null;
  feedback_rating: number | null;
  feedback_interest_level: ShowingFeedbackInterestLevel | null;
  feedback_price_fit: ShowingFeedbackPriceFit | null;
  feedback_would_offer: boolean | null;
};

// ---------------------------------------------------------------------------
// Seller acquisition and transaction foundation
// ---------------------------------------------------------------------------

export type SellerLeadStatus =
  | 'new'
  | 'valuation_requested'
  | 'consultation_requested'
  | 'qualified'
  | 'converted'
  | 'lost';

export type SellerRepresentationType = 'brokerage' | 'designated';

export type SellerJourneyStatus =
  | 'exploring'
  | 'details_in_progress'
  | 'plan_ready'
  | 'professional_review_requested'
  | 'professional_follow_up'
  | 'converted_to_client'
  | 'paused_inactive';

export type SellerJourneyPropertyRelationship =
  'owner' | 'researching' | 'curious';

export type SellerJourney = {
  id: string;
  user_id: string | null;
  anonymous_session_id: string | null;
  property_id: string;
  property_address: string;
  property_unit: string | null;
  property_city: string;
  property_region: string;
  property_postal_code: string;
  property_country: 'CA' | 'US';
  relationship_to_property: SellerJourneyPropertyRelationship | null;
  selling_timeline: string | null;
  property_condition: string | null;
  renovations_upgrades: string | null;
  primary_goal: string | null;
  home_value_request_id: string | null;
  home_value_result_id: string | null;
  status: SellerJourneyStatus;
  created_at: string;
  updated_at: string;
};

export type SellerJourneyCreateRequest = {
  property_id?: string;
  property_address?: string;
  property_unit?: string;
  property_city?: string;
  property_region?: string;
  property_postal_code?: string;
  property_country?: 'CA' | 'US';
  relationship_to_property?: SellerJourneyPropertyRelationship;
  selling_timeline?: string;
  property_condition?: string;
  renovations_upgrades?: string;
  primary_goal?: string;
  home_value_request_id?: string;
  home_value_result_id?: string;
};

export type SellerJourneyUpdateRequest = Omit<
  SellerJourneyCreateRequest,
  'property_country'
> & {
  property_country?: 'CA' | 'US';
};

export type ProfessionalReviewCreateRequest = {
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  request: string;
};

export type ProfessionalReview = {
  seller_lead_id: string;
  seller_journey_id: string;
  property_id: string;
  status: string;
  assigned_agent_id: string | null;
  representation_status: string;
  created_at: string;
};

export type SellerLead = {
  id: string;
  user_id: string | null;
  assigned_agent_id: string | null;
  first_name: string;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  inquiry_type: string;
  status: SellerLeadStatus;
  representation_status: 'none' | 'pending' | 'active' | 'ended';
  source: string | null;
  notes: string | null;
  property_address: string | null;
  property_unit: string | null;
  property_city: string | null;
  property_region: string | null;
  property_postal_code: string | null;
  property_country: string;
  converted_client_id: string | null;
  portal_activated_at: string | null;
  created_at: string;
  updated_at: string;
};

export type SellerLeadCreateRequest = {
  first_name: string;
  last_name?: string;
  email?: string;
  phone?: string;
  agent_email?: string;
  inquiry_type: string;
  source?: string;
  notes?: string;
  property_address?: string;
  property_unit?: string;
  property_city?: string;
  property_region?: string;
  property_postal_code?: string;
  property_country: string;
};

export type SellerLeadUpdateRequest = {
  assigned_agent_id?: string | null;
  status?: Exclude<SellerLeadStatus, 'converted'>;
  notes?: string;
  inquiry_type?: string;
};

/** Explicit staff attestation required to activate an offline seller client. */
export type SellerLeadConvertRequest = {
  representation_type: SellerRepresentationType;
  compliance_approved: true;
};

export type SellerTransaction = {
  id: string;
  seller_client_id: string;
  property_id: string;
  stage: string;
  status: string;
  representation_type: SellerRepresentationType | null;
  representation_status: 'none' | 'pending' | 'active' | 'ended';
  portal_activated_at: string | null;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
};
