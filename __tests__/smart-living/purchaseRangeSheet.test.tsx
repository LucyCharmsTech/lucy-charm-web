/**
 * The purchase-range picker (spec A3).
 *
 * The fixture is the real launch tree, not a simplified one. A trimmed fixture
 * would pass while the actual seventeen-band, two-branch structure broke — and
 * the branch navigation is precisely the part that a three-band fixture cannot
 * exercise.
 *
 * Two rules are asserted here that no server test can reach:
 *
 * - the component never emits a computed basis, only a key or a typed string
 * - "Enter my own amount" is reachable from the top level *and* both branches
 */

import { fireEvent, render, screen, within } from '@testing-library/react';

import PurchaseRangeSheet from '@/components/smart-living/PurchaseRangeSheet';
import type { SmartLivingPublicConfig } from '@/types/api';

const closed = (key: string, min: number, max: number) => ({
  key,
  kind: 'closed' as const,
  min_cents: min * 100,
  max_cents: max * 100,
  branch: null,
});

const CUSTOM = {
  key: 'custom',
  kind: 'exact' as const,
  min_cents: null,
  max_cents: null,
  branch: null,
};

const config: SmartLivingPublicConfig = {
  range_config_version: '2026-08-launch',
  bands: [
    { key: 'under_500k', kind: 'branch', min_cents: null, max_cents: null, branch: 'under_500k' },
    closed('500_600', 500_000, 600_000),
    closed('600_700', 600_000, 700_000),
    closed('700_800', 700_000, 800_000),
    closed('800_900', 800_000, 900_000),
    closed('900_1000', 900_000, 1_000_000),
    { key: '1m_plus', kind: 'branch', min_cents: null, max_cents: null, branch: '1m_plus' },
    CUSTOM,
    { key: 'not_sure', kind: 'no_basis', min_cents: null, max_cents: null, branch: null },
  ],
  branches: {
    under_500k: [
      { key: 'under_300k', kind: 'open_ended', min_cents: null, max_cents: null, branch: null },
      closed('300_400', 300_000, 400_000),
      closed('400_500', 400_000, 500_000),
      CUSTOM,
      { key: 'still_not_sure', kind: 'no_basis', min_cents: null, max_cents: null, branch: null },
    ],
    '1m_plus': [
      closed('1000_1200', 1_000_000, 1_200_000),
      closed('1200_1400', 1_200_000, 1_400_000),
      closed('2800_3000', 2_800_000, 3_000_000),
      { key: '3m_plus', kind: 'open_ended', min_cents: null, max_cents: null, branch: null },
      CUSTOM,
      { key: 'still_not_sure', kind: 'no_basis', min_cents: null, max_cents: null, branch: null },
    ],
  },
  service_area_key: null,
  categories: [],
  catalogue_available: false,
};

function renderSheet(overrides: Partial<React.ComponentProps<typeof PurchaseRangeSheet>> = {}) {
  const onChange = jest.fn();
  render(
    <PurchaseRangeSheet config={config} value={null} onChange={onChange} {...overrides} />,
  );
  return { onChange };
}

function openPanel() {
  fireEvent.click(screen.getByRole('button', { name: /select a price range/i }));
  return screen.getByRole('dialog');
}

// ── The list is not dumped inline ───────────────────────────────────────────

test('no bands are rendered until the control is opened', () => {
  /*
   * Spec A3: a tap-to-open scrollable control, not every range inline. There
   * are seventeen closed bands; inline they are a wall of options above the
   * fold on a phone.
   */
  renderSheet();
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(screen.queryByText('$700K – $800K')).toBeNull();
});

test('opening shows the top level only, not the branch contents', () => {
  renderSheet();
  const panel = openPanel();
  expect(within(panel).getByText('$700K – $800K')).toBeTruthy();
  // `300_400` lives inside the `under_500k` branch and must stay there.
  expect(within(panel).queryByText('$300K – $400K')).toBeNull();
});

// ── Selection emits a key, never a figure ───────────────────────────────────

test('choosing a closed band emits its key and no amount', () => {
  /*
   * The heart of it. `min_cents` and `max_cents` are right there and averaging
   * them would let the UI show an estimate without a round trip — putting a
   * second copy of the benefit arithmetic on the client. The first time the two
   * disagreed, the buyer would see one number in the picker and another on
   * their plan.
   */
  const { onChange } = renderSheet();
  const panel = openPanel();

  fireEvent.click(within(panel).getByText('$700K – $800K'));

  expect(onChange).toHaveBeenCalledWith({
    purchase_range_key: '700_800',
    purchase_amount: null,
  });
  const emitted = onChange.mock.calls[0][0];
  expect(emitted).not.toHaveProperty('purchase_basis_cents');
  expect(JSON.stringify(emitted)).not.toContain('75000000');
});

test('choosing "Not sure yet" emits the key with no amount and no nagging', () => {
  // `no_basis` is an answer, not a gap. It must not open the amount field.
  const { onChange } = renderSheet();
  const panel = openPanel();

  fireEvent.click(within(panel).getByText('Not sure yet'));

  expect(onChange).toHaveBeenCalledWith({
    purchase_range_key: 'not_sure',
    purchase_amount: null,
  });
  expect(screen.queryByLabelText(/enter your amount/i)).toBeNull();
});

test('an open-ended band invites an amount instead of implying one', () => {
  /*
   * `under_300k` has one finite edge. Modelling it as $0–$300K would hand back
   * $150,000 — a number nobody said, then multiplied through three rate steps
   * and shown as their budget.
   */
  const { onChange } = renderSheet();
  const panel = openPanel();

  fireEvent.click(within(panel).getByText('Under $500K'));
  fireEvent.click(screen.getByText('Under $300K'));

  expect(onChange).toHaveBeenCalledWith({ purchase_range_key: 'under_300k' });
  expect(screen.getByLabelText(/enter your amount/i)).toBeTruthy();
});

// ── Branch navigation ───────────────────────────────────────────────────────

test('a branch pushes a narrower list and can be backed out of', () => {
  const { onChange } = renderSheet();
  const panel = openPanel();

  fireEvent.click(within(panel).getByText('Under $500K'));
  expect(screen.getByText('$300K – $400K')).toBeTruthy();
  expect(screen.queryByText('$700K – $800K')).toBeNull();
  // Opening a branch is navigation, not an answer.
  expect(onChange).not.toHaveBeenCalled();

  fireEvent.click(screen.getByText('← All ranges'));
  expect(screen.getByText('$700K – $800K')).toBeTruthy();
});

test('the over-$1M branch carries its bands and its open-ended top', () => {
  renderSheet();
  const panel = openPanel();

  fireEvent.click(within(panel).getByText('Over $1M'));

  expect(screen.getByText('$1M – $1.2M')).toBeTruthy();
  expect(screen.getByText('$2.8M – $3M')).toBeTruthy();
  expect(screen.getByText('$3M+')).toBeTruthy();
});

// ── "Enter my own amount" is always one tap away ────────────────────────────

test.each([
  ['the top level', null],
  ['the under-$500K branch', 'Under $500K'],
  ['the over-$1M branch', 'Over $1M'],
])('"Enter my own amount" is reachable from %s', (_label, branchLabel) => {
  // Spec A3 is explicit. A buyer who knows their number should never have to
  // guess a band first.
  renderSheet();
  const panel = openPanel();
  if (branchLabel) fireEvent.click(within(panel).getByText(branchLabel));

  expect(screen.getByText('Enter my own amount')).toBeTruthy();
});

test('a typed amount is emitted verbatim under the custom band', () => {
  const { onChange } = renderSheet();
  const panel = openPanel();

  fireEvent.click(within(panel).getByText('Enter my own amount'));
  fireEvent.change(screen.getByLabelText(/enter your amount/i), {
    target: { value: '$740,000' },
  });
  fireEvent.click(screen.getByText('Use this amount'));

  // Verbatim: not stripped of its dollar sign, not converted to cents. The
  // server accepts "$740,000" and "740k" alike, and is the only parser.
  expect(onChange).toHaveBeenCalledWith({
    purchase_range_key: 'custom',
    purchase_amount: '$740,000',
  });
});

test('a typed amount under an open-ended band keeps that band key', () => {
  /*
   * The band key is still the funnel step worth recording — "picked under
   * $300K, then typed $250,000" is a different story from "typed $250,000".
   * The resulting basis is identical either way.
   */
  const { onChange } = renderSheet({ value: 'under_300k' });

  fireEvent.click(screen.getByRole('button', { name: /under \$300k/i }));
  fireEvent.click(screen.getByText('Enter my own amount'));
  fireEvent.change(screen.getByLabelText(/enter your amount/i), {
    target: { value: '250000' },
  });
  fireEvent.click(screen.getByText('Use this amount'));

  expect(onChange).toHaveBeenCalledWith({
    purchase_range_key: 'under_300k',
    purchase_amount: '250000',
  });
});

test('an empty amount cannot be submitted', () => {
  const { onChange } = renderSheet();
  const panel = openPanel();

  fireEvent.click(within(panel).getByText('Enter my own amount'));
  const submit = screen.getByText('Use this amount');
  expect((submit as HTMLButtonElement).disabled).toBe(true);

  fireEvent.click(submit);
  expect(onChange).not.toHaveBeenCalled();
});

test('Enter submits the amount', () => {
  const { onChange } = renderSheet();
  const panel = openPanel();

  fireEvent.click(within(panel).getByText('Enter my own amount'));
  const input = screen.getByLabelText(/enter your amount/i);
  fireEvent.change(input, { target: { value: '750k' } });
  fireEvent.keyDown(input, { key: 'Enter' });

  expect(onChange).toHaveBeenCalledWith({
    purchase_range_key: 'custom',
    purchase_amount: '750k',
  });
});

test('the amount field is not a number input', () => {
  // `type="number"` would strip the dollar sign, the separators and the "k"
  // suffix — all of which the server accepts and buyers actually type.
  renderSheet();
  const panel = openPanel();
  fireEvent.click(within(panel).getByText('Enter my own amount'));

  expect(screen.getByLabelText(/enter your amount/i).getAttribute('type')).not.toBe(
    'number',
  );
});

// ── Trigger label ───────────────────────────────────────────────────────────

test('the trigger shows the selected band, including one inside a branch', () => {
  renderSheet({ value: '300_400' });
  expect(
    screen.getByRole('button', { name: /\$300K – \$400K/i }),
  ).toBeTruthy();
});

test('the trigger shows the typed amount when there is one', () => {
  renderSheet({ value: 'custom', amountValue: '$740,000' });
  expect(screen.getByRole('button', { name: /\$740,000/ })).toBeTruthy();
});

// ── Dismissal ───────────────────────────────────────────────────────────────

test('Escape steps back out of the amount field before closing', () => {
  // A buyer mid-way through a selection should not be thrown all the way out
  // by one Escape.
  renderSheet();
  const panel = openPanel();
  fireEvent.click(within(panel).getByText('Enter my own amount'));

  fireEvent.keyDown(document, { key: 'Escape' });
  expect(screen.queryByLabelText(/enter your amount/i)).toBeNull();
  expect(screen.getByRole('dialog')).toBeTruthy();

  fireEvent.keyDown(document, { key: 'Escape' });
  expect(screen.queryByRole('dialog')).toBeNull();
});

test('reopening starts at the top level, not where it was left', () => {
  renderSheet();
  const panel = openPanel();
  fireEvent.click(within(panel).getByText('Under $500K'));
  expect(screen.getByText('$300K – $400K')).toBeTruthy();

  fireEvent.keyDown(document, { key: 'Escape' }); // out of the branch
  fireEvent.keyDown(document, { key: 'Escape' }); // close
  openPanel();

  expect(screen.getByText('$700K – $800K')).toBeTruthy();
  expect(screen.queryByText('$300K – $400K')).toBeNull();
});

test('a disabled picker does not open', () => {
  renderSheet({ disabled: true });
  fireEvent.click(screen.getByRole('button', { name: /select a price range/i }));
  expect(screen.queryByRole('dialog')).toBeNull();
});

test('an error message from the API is shown as an alert', () => {
  renderSheet({
    error: 'Enter a purchase amount in dollars, for example $750,000 or 750k.',
  });
  expect(screen.getByRole('alert').textContent).toMatch(/750k/);
});
