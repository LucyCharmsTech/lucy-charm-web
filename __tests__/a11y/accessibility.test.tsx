import { render } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';

import { AiDisclosure } from '@/components/common/AiDisclosure';
import { ConfirmSubmission } from '@/components/common/ConfirmSubmission';
import { MfaChallengeForm } from '@/components/auth/MfaChallengeForm';
import { MfaRecoveryCodes } from '@/components/security/MfaRecoveryCodes';
import { NotSureField } from '@/components/homeValue/NotSureField';
import { HomeValueReport } from '@/components/homeValue/HomeValueReport';
import { PortalCard } from '@/components/portal/PortalCard';
import { ContentSection } from '@/components/content/ContentSection';
import type { HomeValueRequestRead } from '@/types/homeValue';

/**
 * WCAG 2.2 AA — controls 2.6 and 2.8, plan item 4.7.
 *
 * `axe` rather than a manual pass, for one reason: a manual pass is a claim
 * about a moment, and this is a claim that has to stay true. Every component
 * added after today either passes these rules or fails a test.
 *
 * ### What axe does and does not prove
 *
 * It catches what is machine-checkable: missing labels, unnamed controls,
 * broken ARIA, non-text content without alternatives, invalid roles and
 * nesting. That is the majority of real-world failures and **it is not all of
 * WCAG**. Focus order, keyboard traps, whether alt text is *useful* rather
 * than merely present, and whether an error message actually explains
 * anything, are human judgements a checker cannot make.
 *
 * So this file is evidence, not a certificate. `.docs/accessibility-and-cwv.md`
 * says which parts were checked how — the same distinction Hamed drew for
 * performance: *"Do not claim a field pass from lab results alone."*
 *
 * Colour contrast is deliberately switched off in these runs: jsdom has no
 * layout engine and cannot compute rendered colours, so axe's contrast rule
 * returns "incomplete" rather than a result. Reporting that as a pass would be
 * claiming something that was never measured. Contrast is checked in the
 * browser instead, and recorded in the doc.
 */

expect.extend(toHaveNoViolations);

const AXE_OPTIONS = {
  rules: {
    // See the note above — no layout engine, so this cannot be evaluated here.
    'color-contrast': { enabled: false },
  },
};

async function expectAccessible(ui: React.ReactElement) {
  const { container } = render(ui);
  expect(await axe(container, AXE_OPTIONS)).toHaveNoViolations();
}

// ── Things a person types into ───────────────────────────────────────────────

test('the two-step verification challenge is accessible', async () => {
  await expectAccessible(
    <MfaChallengeForm challengeToken="c" onVerified={jest.fn()} onCancel={jest.fn()} />,
  );
});

test('the "Not sure" field is accessible in both of its states', async () => {
  await expectAccessible(
    <NotSureField id="a11y-beds" label="Bedrooms" value={undefined} onChange={jest.fn()} />,
  );
  // The checked state disables the input, and a disabled control still needs
  // its name — this is where a label tied only to a placeholder would fail.
  await expectAccessible(
    <NotSureField id="a11y-beds2" label="Bedrooms" value="not_sure" onChange={jest.fn()} />,
  );
});

test('the confirmation step is accessible', async () => {
  await expectAccessible(
    <ConfirmSubmission
      title="Send your request"
      summary={['We will ask the agent for a viewing.', 'This is a request, not a booking.']}
      confirmLabel="Send request"
      onConfirm={jest.fn()}
      onBack={jest.fn()}
    />,
  );
});

// ── Things a person reads ────────────────────────────────────────────────────

test('the recovery codes screen is accessible', async () => {
  await expectAccessible(
    <MfaRecoveryCodes codes={['aaaa111111-2222bbbbbb']} onDone={jest.fn()} />,
  );
});

test('the AI disclosure is accessible in both variants', async () => {
  await expectAccessible(<AiDisclosure variant="inline" />);
  await expectAccessible(<AiDisclosure variant="banner" />);
});

test('a published Home Value report is accessible', async () => {
  const request: HomeValueRequestRead = {
    id: 'r1',
    address: '12 Elm Street',
    unit: null,
    full_name: 'Dana Okafor',
    relationship: 'owner',
    represented_elsewhere: 'no',
    status: 'report_ready',
    property_type: null,
    beds: null,
    baths: null,
    parking: null,
    approximate_size: null,
    condition: null,
    renovations: null,
    timeline: null,
    condo_details: null,
    phone: null,
    consultation_preference: null,
    value_low: 900000,
    value_high: 950000,
    limitations: 'Exterior viewing only.',
    report_summary: 'Comparable sales support this range.',
    published_at: '2026-09-01T00:00:00Z',
    created_at: '2026-08-20T00:00:00Z',
  };
  await expectAccessible(<HomeValueReport request={request} />);
});

test('a published content section is accessible', async () => {
  await expectAccessible(
    <ContentSection
      block={{ heading: 'Our service area', paragraphs: ['We work across the GTA.'] }}
      id="service-area"
    />,
  );
});

// ── Every portal card state ──────────────────────────────────────────────────

test.each([
  'loading',
  'empty',
  'success',
  'pending',
  'no_action_needed',
  'unavailable',
  'locked',
  'expired',
  'permission_denied',
] as const)('the portal card is accessible in the %s state', async (state) => {
  // Each state renders different markup — a spinner, an alert, a retry button.
  // Testing only the happy one would miss the two that use live regions.
  await expectAccessible(<PortalCard title="Saved homes" state={state} />);
});
