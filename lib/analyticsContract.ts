/**
 * Browser projection of the Section 13 analytics registry.
 *
 * The canonical registry is server-side.  This intentionally contains only
 * existing PostHog names and browser-safe property keys; conversion metadata
 * and server-only events stay out of the client bundle.
 */
import { analyticsRouteFamily } from '@/lib/analyticsRoutes';

type BrowserEventDefinition = {
  required: readonly string[];
  optional?: readonly string[];
};

export const browserAnalyticsEventDefinitions = {
  $pageview: { required: ['$current_url'] },
  web_vital: { required: ['metric', 'value', 'rating'] },
  journey_stage_viewed: { required: ['journey_type', 'stage'] },
  journey_primary_action: { required: ['journey_type', 'stage', 'outcome'] },
  portal_module_error: { required: ['module', 'reason'] },
  signup_completed: { required: [] },
  search_performed: { required: [] },
  listing_viewed: { required: ['listing_id'] },
  listing_saved: { required: ['listing_id'] },
  property_reaction_set: { required: ['listing_id', 'reaction'] },
  search_shared: { required: ['method'] },
  chat_opened: { required: [], optional: ['surface', 'listing_id'] },
  chat_started: { required: [], optional: ['surface', 'listing_id'] },
  chat_escalated: { required: [], optional: ['surface', 'listing_id'] },
  showing_requested: { required: ['listing_id'] },
  property_review_status_changed: { required: ['request_id', 'listing_id', 'status'] },
  property_checkup_interest_signal: { required: ['listing_id', 'reason'] },
  property_checkup_opened: { required: ['listing_id'] },
  property_checkup_view_full: { required: ['listing_id'] },
  property_checkup_ask_representative: { required: ['listing_id', 'rule_id'] },
  property_checkup_question_saved: { required: ['listing_id', 'rule_id'] },
  property_checkup_showing_question_added: { required: ['listing_id', 'rule_id'] },
  property_checkup_deeper_review_requested: { required: ['listing_id'] },
  product_feedback_helpful: { required: ['context', 'helpful'] },
  product_problem_reported: { required: ['context', 'category'] },
  form_abandoned: { required: ['form'] },
} as const satisfies Record<string, BrowserEventDefinition>;

const PRIVATE_KEY_PARTS = [
  'address', 'api_key', 'authorization', 'content', 'credential', 'document',
  'email', 'evidence', 'file', 'first_name', 'last_name', 'message', 'note',
  'password', 'phone', 'report', 'secret', 'summary', 'text', 'token', 'upload',
];
const OPAQUE_ID = /^[A-Za-z0-9_-]{1,128}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SAFE_LABEL = /^[A-Za-z0-9 .,'&/-]{1,128}$/;
const SAFE_CODE = /^[A-Za-z0-9_.:-]{1,128}$/;
const EMAIL = /[^\s@]+@[^\s@]+\.[^\s@]+/;
const PHONE = /\+?\d[\d\s().-]{6,}\d/;
const SECRET = /(?:^|\s)(?:bearer\s+|basic\s+|sk-[A-Za-z0-9]|eyJ[A-Za-z0-9_-]+\.)/i;
const FEEDBACK_CONTEXTS = new Set([
  'search', 'listing', 'ai_chat', 'showing', 'home_value',
  'documents', 'buyer_portal', 'seller_portal', 'contact',
]);
const PROBLEM_CATEGORIES = new Set(['bug', 'content', 'accessibility', 'other']);
const ABANDONED_FORMS = new Set(['contact_form', 'home_value', 'showing_request']);
const VALUE_TAXONOMY: Record<string, ReadonlySet<string>> = {
  metric: new Set(['LCP', 'INP', 'CLS']),
  rating: new Set(['good', 'needs-improvement', 'poor']),
  journey_type: new Set(['buyer', 'seller']),
  outcome: new Set(['started', 'succeeded', 'failed']),
  reaction: new Set(['love', 'maybe', 'not_for_me']),
  method: new Set(['share_sheet', 'clipboard']),
  surface: new Set(['general', 'listing']),
  status: new Set(['requested', 'under_review', 'response_ready']),
};

function isPrivateKey(key: string): boolean {
  if (key === 'context') return false; // Values have a strict route-family allowlist.
  const normalized = key.toLowerCase().replaceAll('-', '_');
  return PRIVATE_KEY_PARTS.some((part) => normalized.includes(part));
}

function isSafeValue(key: string, value: unknown): boolean {
  if (key in VALUE_TAXONOMY) return typeof value === 'string' && VALUE_TAXONOMY[key].has(value);
  if (key === 'helpful') return typeof value === 'boolean';
  if (key === 'value') return typeof value === 'number' && Number.isFinite(value);
  if (key === 'context') return typeof value === 'string' && FEEDBACK_CONTEXTS.has(value);
  if (key === 'category') return typeof value === 'string' && PROBLEM_CATEGORIES.has(value);
  if (key === 'form') return typeof value === 'string' && ABANDONED_FORMS.has(value);
  if (typeof value === 'boolean' || typeof value === 'number') return false;
  if (typeof value === 'string' && (key.endsWith('_id') || key === 'rule_id')) {
    return key === 'listing_id' || key === 'request_id' ? UUID.test(value) : OPAQUE_ID.test(value);
  }
  if (typeof value !== 'string' || value.length > 256 || EMAIL.test(value) || PHONE.test(value)) {
    return false;
  }
  if (SECRET.test(value)) return false;
  if (key === '$current_url') {
    try {
      const parsed = new URL(value);
      return parsed.origin === window.location.origin
        && !parsed.search && !parsed.hash
        && analyticsRouteFamily(parsed.pathname) === parsed.pathname;
    } catch { return false; }
  }
  if (key === 'city' || key === 'country') return SAFE_LABEL.test(value);
  return SAFE_CODE.test(value);
}

/** Returns false rather than forwarding unknown or unsafe telemetry. */
export function isApprovedBrowserAnalyticsEvent(
  event: string,
  properties: Record<string, unknown> = {},
): boolean {
  const definition = browserAnalyticsEventDefinitions[event as keyof typeof browserAnalyticsEventDefinitions];
  if (!definition) return false;
  const keys = Object.keys(properties);
  const optional = 'optional' in definition ? definition.optional : [];
  const allowed = new Set<string>([...definition.required, ...optional]);
  if (definition.required.some((key) => !(key in properties))) return false;
  if (keys.some((key) => !allowed.has(key) || isPrivateKey(key))) return false;
  if (event === 'portal_module_error' && (
    properties.module !== 'journey_next_action' || properties.reason !== 'unavailable'
  )) return false;
  if (event === 'property_checkup_interest_signal' && !['revisit', 'saved'].includes(String(properties.reason))) return false;
  return keys.every((key) => isSafeValue(key, properties[key]));
}
