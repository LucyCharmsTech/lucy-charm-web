type FastApiValidationError = {
  type?: string;
  loc?: Array<string | number>;
  msg?: string;
  input?: unknown;
  ctx?: Record<string, unknown>;
};

const FIELD_LABELS: Record<string, string> = {
  min_bathrooms: 'Minimum bathrooms',
  min_bedrooms: 'Minimum bedrooms',
  budget_min: 'Budget minimum',
  budget_max: 'Budget maximum',
  preferred_country: 'Preferred country',
  preferred_city: 'Preferred city',
  property_types: 'Property types',
  main_priorities: 'Main priorities',
  financing_status: 'Pre-approval status',
  timeline: 'Buying timeline',
};

function fieldLabelFromLoc(loc: Array<string | number> | undefined): string | null {
  if (!loc?.length) return null;
  const field = [...loc].reverse().find((part) => typeof part === 'string' && part !== 'body');
  if (typeof field !== 'string') return null;
  return FIELD_LABELS[field] ?? field.replace(/_/g, ' ');
}

function formatValidationError(error: FastApiValidationError): string {
  const label = fieldLabelFromLoc(error.loc);
  const message = error.msg ?? 'Invalid value';
  return label ? `${label}: ${message}` : message;
}

/** Normalize FastAPI / Axios error payloads into a user-facing string. */
export function getApiErrorMessage(
  err: unknown,
  fallback = 'Something went wrong. Please try again.',
): string {
  const detail = (err as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail;

  if (typeof detail === 'string' && detail.trim()) {
    return detail;
  }

  if (Array.isArray(detail)) {
    const messages = detail
      .map((entry) => {
        if (typeof entry === 'string') return entry;
        if (entry && typeof entry === 'object' && 'msg' in entry) {
          return formatValidationError(entry as FastApiValidationError);
        }
        return null;
      })
      .filter((message): message is string => Boolean(message));

    if (messages.length > 0) {
      return messages.join(' ');
    }
  }

  if (detail && typeof detail === 'object' && 'msg' in detail) {
    return formatValidationError(detail as FastApiValidationError);
  }

  return fallback;
}
