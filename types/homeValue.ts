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

export type OwnerRelationship = 'owner' | 'researching' | 'other';
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
};

/** A reviewer's work in progress. Never visible to the requester. */
export type HomeValueDraftBody = {
  value_low?: number | null;
  value_high?: number | null;
  limitations?: string | null;
  report_summary?: string | null;
  internal_notes?: string | null;
};

/**
 * Publication. Every field required — publishing is the moment a person puts
 * their name to a valuation opinion, and it should take the complete thing
 * rather than whatever happened to be saved.
 */
export type HomeValuePublishBody = {
  value_low: number;
  value_high: number;
  limitations: string;
  report_summary: string;
};
