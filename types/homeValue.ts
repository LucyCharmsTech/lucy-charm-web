/**
 * Home Value — plan item 4.2, from Hamed's specification.
 *
 * `"not_sure"` is a first-class value on every optional property fact, not an
 * absence. Hamed: *"Provide 'Not sure' for uncertain property facts."*
 * Blank means nobody said anything; "Not sure" means the owner looked and does
 * not know, which is itself information for the reviewer.
 *
 * There is deliberately **no** field for a document, an attachment, or an
 * identity or financial detail — *"Do not request ID or financial documents in
 * this initial form."*
 */

export const NOT_SURE = 'not_sure';

export type OwnerRelationship = 'owner' | 'researching' | 'curious' | 'other';
export type RepresentedElsewhere = 'yes' | 'no' | 'not_sure';

export type HomeValueRequestBody = {
  // Required
  address: string;
  unit?: string;
  full_name: string;
  relationship: OwnerRelationship;
  represented_elsewhere: RepresentedElsewhere;

  // Optional — each may also be "not_sure"
  property_type?: string;
  beds?: string;
  baths?: string;
  parking?: string;
  approximate_size?: string;
  condition?: string;
  renovations?: string;
  timeline?: string;
  condo_details?: string;
  phone?: string;
  consultation_preference?: string;
};

export type HomeValueStatus = 'submitted' | 'under_review' | 'report_ready';
export type HomeValueReportOutcome =
  | 'estimated_range'
  | 'needs_more_information'
  | 'unable_to_estimate_reliably';
export type HomeValueDataSupport = 'strong' | 'moderate' | 'limited';
export type HomeValueEvidenceType = 'sold_comparable' | 'active_listing' | 'other';
export type HomeValueFollowUpType = 'correction' | 'more_information' | 'consultation';
export type HomeValueFollowUpStatus = 'open' | 'in_review' | 'resolved';

export type HomeValueAiDraftSuggestions = {
  normalized_property_facts: string[];
  missing_information: string[];
  conflict_suggestions: string[];
  assumptions: string[];
  unknowns: string[];
  local_market_context: string | null;
  value_factors: string[];
  reconciliation: string | null;
  report_summary: string | null;
};

export type HomeValueFollowUp = {
  id: string;
  home_value_request_id: string;
  report_version_id: string | null;
  request_type: HomeValueFollowUpType;
  message: string;
  status: HomeValueFollowUpStatus;
  created_at: string;
  resolved_at: string | null;
};

export type HomeValueFollowUpStaff = HomeValueFollowUp & {
  homeowner_user_id: string;
  reviewer_user_id: string | null;
  resolution_notes: string | null;
};

export type HomeValuePublishedEvidence = {
  id: string;
  summary: string;
};
export type HomeValueReportVersion = {
  id: string;
  version_number: number;
  report_outcome: HomeValueReportOutcome;
  value_low: number | null;
  value_high: number | null;
  published_at: string;
  publisher_display_name: string | null;
  report_summary: string | null;
  outcome_explanation: string | null;
  data_support: HomeValueDataSupport | null;
  data_support_explanation: string | null;
  approved_property_facts: string[] | null;
  assumptions: string[] | null;
  unknowns: string[] | null;
  conflicts: string[] | null;
  local_market_context: string | null;
  value_factors: string[] | null;
  reconciliation: string | null;
  report_as_of_date: string | null;
  published_evidence: HomeValuePublishedEvidence[];
  disclaimer: string;
};

export type HomeValueRequestRead = {
  id: string;
  address: string;
  unit: string | null;
  full_name: string;
  relationship: string;
  represented_elsewhere: string;
  status: HomeValueStatus;
  property_type: string | null;
  beds: string | null;
  baths: string | null;
  parking: string | null;
  approximate_size: string | null;
  condition: string | null;
  renovations: string | null;
  timeline: string | null;
  condo_details: string | null;
  phone: string | null;
  consultation_preference: string | null;
  /**
   * Null until the report is published. The server blanks these rather than
   * relying on this page to hide them — a draft valuation must not travel to
   * the browser at all.
   */
  value_low: number | null;
  value_high: number | null;
  limitations: string | null;
  report_summary: string | null;
  report_outcome?: HomeValueReportOutcome | null;
  outcome_explanation?: string | null;
  data_support?: HomeValueDataSupport | null;
  data_support_explanation?: string | null;
  approved_property_facts?: string[] | null;
  assumptions?: string[] | null;
  unknowns?: string[] | null;
  conflicts?: string[] | null;
  local_market_context?: string | null;
  value_factors?: string[] | null;
  reconciliation?: string | null;
  report_as_of_date?: string | null;
  report_version_number?: number | null;
  published_evidence?: HomeValuePublishedEvidence[];
  published_at: string | null;
  created_at: string;
};


/**
 * What a reviewer sees. Adds the fields a requester must never receive:
 * internal notes and the compliance state are staff business, and publishing
 * them would make every working note a client-facing document.
 */
export type HomeValueRequestStaff = HomeValueRequestRead & {
  user_id: string;
  assigned_agent_id: string | null;
  internal_notes: string | null;
  compliance_cleared_at: string | null;
  compliance_cleared_by_user_id: string | null;
  representation_review_status?: 'not_required' | 'required' | 'acknowledged';
  representation_reviewed_at?: string | null;
  representation_reviewed_by_user_id?: string | null;
};

/** A reviewer's work in progress. Never visible to the requester. */
export type HomeValueDraftBody = {
  value_low?: number | null;
  value_high?: number | null;
  limitations?: string | null;
  report_summary?: string | null;
  report_outcome?: HomeValueReportOutcome | null;
  outcome_explanation?: string | null;
  data_support?: HomeValueDataSupport | null;
  data_support_explanation?: string | null;
  approved_property_facts?: string[] | null;
  assumptions?: string[] | null;
  unknowns?: string[] | null;
  conflicts?: string[] | null;
  local_market_context?: string | null;
  value_factors?: string[] | null;
  reconciliation?: string | null;
  report_as_of_date?: string | null;
  internal_notes?: string | null;
};

/**
 * Publication. Every field required — publishing is the moment a person puts
 * their name to a valuation opinion, and it should take the complete thing
 * rather than whatever happened to be saved.
 */
export type HomeValuePublishBody = {
  report_outcome: HomeValueReportOutcome;
  value_low?: number | null;
  value_high?: number | null;
  limitations?: string | null;
  report_summary?: string | null;
  outcome_explanation?: string | null;
  data_support?: HomeValueDataSupport | null;
  data_support_explanation?: string | null;
  approved_property_facts?: string[] | null;
  assumptions?: string[] | null;
  unknowns?: string[] | null;
  conflicts?: string[] | null;
  local_market_context?: string | null;
  value_factors?: string[] | null;
  reconciliation?: string | null;
  report_as_of_date?: string | null;
};

export type HomeValueEvidence = {
  id: string;
  home_value_request_id: string;
  evidence_type: HomeValueEvidenceType;
  reference: string | null;
  address: string | null;
  source_date: string | null;
  value: number | null;
  why_relevant: string;
  similarities: string | null;
  differences: string | null;
  adjustments: string | null;
  limitations: string | null;
  internal_source_notes: string | null;
  is_publishable: boolean;
  publishable_summary: string | null;
  created_at: string;
  updated_at: string;
};

export type HomeValueEvidenceBody = Omit<
  HomeValueEvidence,
  'id' | 'home_value_request_id' | 'created_at' | 'updated_at'
>;
