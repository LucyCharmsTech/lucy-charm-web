import { fireEvent, render, screen } from '@testing-library/react';
import {
  PORTAL_CARD_STATES,
  PortalCard,
  isRetryable,
  portalStateMessage,
  type PortalCardState,
} from '@/components/portal/PortalCard';

/**
 * Control 6.14: *"Each card/page defines **loading, empty, success, pending,
 * no-action-needed, unavailable, locked, expired and permission-denied**
 * states."*
 *
 * Defined once rather than per card, because nine states written nine times
 * become nine slightly different vocabularies.
 */

test('all nine states the control names exist', () => {
  expect(PORTAL_CARD_STATES).toEqual([
    'loading',
    'empty',
    'success',
    'pending',
    'no_action_needed',
    'unavailable',
    'locked',
    'expired',
    'permission_denied',
  ]);
});

test('every state has wording — none renders as a blank card', () => {
  for (const state of PORTAL_CARD_STATES) {
    expect(portalStateMessage(state).length).toBeGreaterThan(0);
  }
});

test('empty and no-action-needed say opposite things', () => {
  // "You have nothing" invites an action. "Nothing needs you" says the
  // opposite. Collapsing them makes a finished checklist look broken.
  expect(portalStateMessage('empty')).not.toEqual(
    portalStateMessage('no_action_needed'),
  );
  expect(portalStateMessage('no_action_needed')).toContain('Nothing needs your attention');
});

test('locked reads as "not yet", permission-denied as "not yours"', () => {
  expect(portalStateMessage('locked')).toContain('unlocks');
  expect(portalStateMessage('permission_denied')).toContain('do not have access');
});

test('only unavailable offers a retry', () => {
  // Retrying an expired thing wastes the reader's time; retrying something
  // they are not allowed to see wastes it twice.
  const retryable = PORTAL_CARD_STATES.filter(isRetryable);
  expect(retryable).toEqual(['unavailable']);
});

test('a retry button appears only where a retry could help', () => {
  const onRetry = jest.fn();
  const { rerender } = render(
    <PortalCard title="Documents" state="unavailable" onRetry={onRetry} />,
  );
  expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy();

  for (const state of ['expired', 'locked', 'permission_denied'] as PortalCardState[]) {
    rerender(<PortalCard title="Documents" state={state} onRetry={onRetry} />);
    expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull();
  }
});

test('the retry actually retries', () => {
  const onRetry = jest.fn();
  render(<PortalCard title="Documents" state="unavailable" onRetry={onRetry} />);

  fireEvent.click(screen.getByRole('button', { name: 'Try again' }));

  expect(onRetry).toHaveBeenCalled();
});

test('loading is announced as busy', () => {
  render(<PortalCard title="Documents" state="loading" />);

  expect(screen.getByLabelText('Documents').getAttribute('aria-busy')).toBe('true');
});

test('only a real problem interrupts a screen reader', () => {
  // Being told there is nothing to do should not be an alert.
  const { rerender } = render(<PortalCard title="Documents" state="unavailable" />);
  expect(screen.getByRole('alert')).toBeTruthy();

  rerender(<PortalCard title="Documents" state="no_action_needed" />);
  expect(screen.queryByRole('alert')).toBeNull();
  expect(screen.getByRole('status')).toBeTruthy();
});

test('content renders only on success', () => {
  const { rerender } = render(
    <PortalCard title="Documents" state="success">
      <p>Three documents</p>
    </PortalCard>,
  );
  expect(screen.getByText('Three documents')).toBeTruthy();

  rerender(
    <PortalCard title="Documents" state="pending">
      <p>Three documents</p>
    </PortalCard>,
  );
  expect(screen.queryByText('Three documents')).toBeNull();
});

test('a caller can say something more specific than the default', () => {
  render(
    <PortalCard title="Documents" state="empty" message="No documents requested yet." />,
  );

  expect(screen.getByText('No documents requested yet.')).toBeTruthy();
});
