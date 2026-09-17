'use client';

import { useReportWebVitals } from 'next/web-vitals';
import { track } from '@/lib/analytics';

/**
 * Field measurement of Core Web Vitals — control 2.8, plan item 4.7.
 *
 * Hamed was explicit about the distinction:
 *
 *     "Before traffic is sufficient, use representative mobile/lab tests;
 *      measure field data after launch. **Do not claim a field pass from lab
 *      results alone.**"
 *
 * Lab results exist (Lighthouse, recorded in
 * `.docs/accessibility-and-cwv.md`). This is the other half: without it there
 * would be **no way to ever measure the field data**, and the lab number would
 * quietly become the only number anyone ever cited — which is precisely what
 * that instruction warns against.
 *
 * The targets are the 75th percentile of real visits: LCP ≤ 2.5s, INP ≤ 200ms,
 * CLS ≤ 0.10. A percentile cannot be computed from a lab run on one machine on
 * one connection, by definition.
 *
 * ### What is sent
 *
 * The metric name, its value, and the rating the browser itself assigns. **No
 * URL, no identifiers, no referrer** — a performance sample does not need to
 * say which property someone was looking at, and control 5.19's minimization
 * applies here as much as anywhere.
 *
 * `track()` is already a no-op until cookie consent is given and swallows its
 * own failures, so this cannot delay or break a page. It reports what the
 * browser observed and nothing else.
 */
export function WebVitalsReporter() {
  useReportWebVitals((metric) => {
    // Next reports its own timings (hydration, render) alongside the web
    // vitals. Only the three the control names are wanted; the rest would be
    // noise in the same dashboard.
    if (!['LCP', 'INP', 'CLS'].includes(metric.name)) return;

    track('web_vital', {
      metric: metric.name,
      // CLS is unitless and small; the others are milliseconds. Rounded so a
      // dashboard is not storing sixteen significant figures of nothing.
      value: metric.name === 'CLS' ? Number(metric.value.toFixed(4)) : Math.round(metric.value),
      // "good" | "needs-improvement" | "poor", as the browser classifies it
      // against the same thresholds the control names.
      rating: metric.rating,
    });
  });

  return null;
}
