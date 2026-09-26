import { getPostLoginPath } from '@/lib/postLoginRedirect';

describe('getPostLoginPath', () => {
  it('sends an active agent to their dashboard instead of stale onboarding', () => {
    expect(getPostLoginPath('agent', '/agent/onboarding')).toBe('/agent');
  });

  it('preserves links to active-agent workspace pages', () => {
    expect(getPostLoginPath('agent', '/agent/showings')).toBe('/agent/showings');
  });
});
