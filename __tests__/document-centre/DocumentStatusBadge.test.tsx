/**
 * The badge has two vocabularies on purpose: clients read what the agent did
 * ("Rejected", "New copy requested"), staff read the literal state. The
 * Overdue chip is advisory-only UI and must appear solely on an overdue
 * `requested` row. See .docs/document-centre.md § Status model.
 */

import { render, screen } from '@testing-library/react';
import DocumentStatusBadge from '@/components/documents/DocumentStatusBadge';

describe('client vocabulary — says what the agent did', () => {
  it.each([
    ['requested', 'Requested by your agent'],
    ['rejected', 'Rejected'],
    ['replacement_needed', 'New copy requested'],
    ['accepted', 'Approved'],
    ['uploaded', 'In review'],
    ['under_review', 'In review'],
    ['missing', 'Still needed'],
    ['expired', 'Expired'],
    ['superseded', 'Previous version'],
  ] as const)('%s renders as "%s"', (status, label) => {
    render(<DocumentStatusBadge status={status} />);
    expect(screen.getByText(label)).toBeTruthy();
  });
});

describe('staff vocabulary — the literal state', () => {
  it.each([
    ['uploaded', 'Uploaded'],
    ['under_review', 'Under review'],
    ['accepted', 'Accepted'],
    ['replacement_needed', 'Replacement needed'],
    ['missing', 'Missing'],
  ] as const)('%s renders as "%s"', (status, label) => {
    render(<DocumentStatusBadge status={status} staff />);
    expect(screen.getByText(label)).toBeTruthy();
  });
});

describe('the Overdue chip', () => {
  it('appears on an overdue requested row', () => {
    render(<DocumentStatusBadge status="requested" overdue />);
    expect(screen.getByText('Overdue')).toBeTruthy();
  });

  it('never appears once something was uploaded, even if the flag is passed', () => {
    render(<DocumentStatusBadge status="uploaded" overdue />);
    expect(screen.queryByText('Overdue')).toBeNull();
  });

  it('is absent when not overdue', () => {
    render(<DocumentStatusBadge status="requested" />);
    expect(screen.queryByText('Overdue')).toBeNull();
  });
});
