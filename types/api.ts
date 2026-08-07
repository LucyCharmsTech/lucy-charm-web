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

export type MagicLinkRequestBody = {
  email: string;
  redirect_path?: string;
  /** Signup only — required on /register, omitted on /login. */
  full_name?: string;
};

export type MagicLinkRequestResponse = {
  detail: string;
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

export type UserDataRequestType = 'access' | 'correction' | 'deletion' | 'portability';

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

export type OnboardingPrimaryIntent = 'buyer' | 'seller' | 'investor' | 'exploring';
export type OnboardingTimeline = 'asap' | '1_3_months' | '3_6_months' | '6_plus_months';
export type OnboardingPropertyType = 'house' | 'condo' | 'townhome' | 'multi_family' | 'other';
export type OnboardingFinancingStatus = 'pre_approved' | 'not_yet' | 'cash' | 'prefer_not_to_say';
export type OnboardingMainPriority =
  | 'price'
  | 'location'
  | 'size'
  | 'schools'
  | 'investment'
  | 'lifestyle';

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
  response_type: 'general_information' | 'professional_advice' | 'clarification' | 'data_unavailable';
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

export type ShowingRequestStatus = 'pending' | 'confirmed' | 'rescheduled' | 'cancelled' | 'completed';
export type ShowingType = 'in_person' | 'virtual' | 'open_house';
export type ShowingIdVerificationStatus = 'not_requested' | 'pending' | 'verified';
export type ShowingFeedbackInterestLevel = 'low' | 'medium' | 'high';
export type ShowingFeedbackPriceFit = 'below_budget' | 'on_target' | 'above_budget';

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

export type ShowingVerificationDocument = {
  id: string;
  showing_request_id: string;
  original_filename: string;
  content_type: string;
  size_bytes: number;
  status: 'uploaded' | 'verified' | 'rejected';
  reviewed_at: string | null;
  review_note: string | null;
  viewed_at: string | null;
  created_at: string;
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
  | 'report.status_updated';

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
export type RealtimeRejectReason = 'not_authorized' | 'unknown_channel' | 'channel_limit';

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
  document_status?: ShowingVerificationDocument['status'];
  /** Present when the change came from an agent reviewing a document. */
  review_status?: 'verified' | 'rejected';
};

export type ShowingDocumentUploadedPayload = {
  showing_request_id: string;
  listing_id: string;
  document_id: string;
  document_status: ShowingVerificationDocument['status'];
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
