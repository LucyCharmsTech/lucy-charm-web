/**
 * Signed-out "Save question" storage (Property Checkup Clarifications
 * Part 1 §7). Covers: it never touches the network while signed out, it is
 * idempotent, and syncing on sign-in clears only what actually succeeded.
 */

jest.mock('@/services/propertyCheckupService', () => ({
  addPropertyCheckupQuestion: jest.fn(),
}));

import { addPropertyCheckupQuestion } from '@/services/propertyCheckupService';
import {
  isQuestionSavedLocally,
  saveQuestionLocally,
  syncLocalQuestionsToAccount,
} from '@/lib/propertyCheckupLocalQuestions';

const mockAdd = addPropertyCheckupQuestion as jest.Mock;

beforeEach(() => {
  localStorage.clear();
  mockAdd.mockReset();
});

describe('saveQuestionLocally / isQuestionSavedLocally', () => {
  it('is not saved until saveQuestionLocally is called', () => {
    expect(isQuestionSavedLocally('listing-1', 'septic_system')).toBe(false);
  });

  it('is saved after saveQuestionLocally', () => {
    saveQuestionLocally('listing-1', 'septic_system');
    expect(isQuestionSavedLocally('listing-1', 'septic_system')).toBe(true);
  });

  it('never calls the network while signed out', () => {
    saveQuestionLocally('listing-1', 'septic_system');
    expect(mockAdd).not.toHaveBeenCalled();
  });

  it('is idempotent — saving the same rule twice stores one entry', () => {
    saveQuestionLocally('listing-1', 'septic_system');
    saveQuestionLocally('listing-1', 'septic_system');
    const raw = JSON.parse(localStorage.getItem('lucy-property-checkup-local-questions')!);
    expect(raw).toHaveLength(1);
  });

  it('keeps different listings and different rules separate', () => {
    saveQuestionLocally('listing-1', 'septic_system');
    saveQuestionLocally('listing-1', 'well_water');
    saveQuestionLocally('listing-2', 'septic_system');
    expect(isQuestionSavedLocally('listing-1', 'well_water')).toBe(true);
    expect(isQuestionSavedLocally('listing-2', 'septic_system')).toBe(true);
    expect(isQuestionSavedLocally('listing-2', 'well_water')).toBe(false);
  });
});

describe('syncLocalQuestionsToAccount', () => {
  it('does nothing when there is nothing pending', async () => {
    await syncLocalQuestionsToAccount();
    expect(mockAdd).not.toHaveBeenCalled();
  });

  it('pushes every pending question with kind "saved"', async () => {
    mockAdd.mockResolvedValue({});
    saveQuestionLocally('listing-1', 'septic_system');
    saveQuestionLocally('listing-1', 'well_water');

    await syncLocalQuestionsToAccount();

    expect(mockAdd).toHaveBeenCalledTimes(2);
    expect(mockAdd).toHaveBeenCalledWith({
      listing_id: 'listing-1',
      source_rule_id: 'septic_system',
      kind: 'saved',
    });
  });

  it('clears local storage once every push succeeds', async () => {
    mockAdd.mockResolvedValue({});
    saveQuestionLocally('listing-1', 'septic_system');

    await syncLocalQuestionsToAccount();

    expect(isQuestionSavedLocally('listing-1', 'septic_system')).toBe(false);
  });

  it('keeps only the entries that failed to sync, not all of them', async () => {
    mockAdd
      .mockResolvedValueOnce({}) // septic_system succeeds
      .mockRejectedValueOnce(new Error('network error')); // well_water fails
    saveQuestionLocally('listing-1', 'septic_system');
    saveQuestionLocally('listing-1', 'well_water');

    await syncLocalQuestionsToAccount();

    expect(isQuestionSavedLocally('listing-1', 'septic_system')).toBe(false);
    expect(isQuestionSavedLocally('listing-1', 'well_water')).toBe(true);
  });

  it('is safe to call again after a partial failure — no duplicate pushes for the succeeded one', async () => {
    mockAdd
      .mockResolvedValueOnce({})
      .mockRejectedValueOnce(new Error('network error'));
    saveQuestionLocally('listing-1', 'septic_system');
    saveQuestionLocally('listing-1', 'well_water');
    await syncLocalQuestionsToAccount();

    mockAdd.mockClear();
    mockAdd.mockResolvedValue({});
    await syncLocalQuestionsToAccount();

    expect(mockAdd).toHaveBeenCalledTimes(1);
    expect(mockAdd).toHaveBeenCalledWith({
      listing_id: 'listing-1',
      source_rule_id: 'well_water',
      kind: 'saved',
    });
  });
});
