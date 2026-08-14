/**
 * Jest via next/jest (SWC transform, tsconfig paths honoured automatically).
 * Scope is deliberately narrow: __tests__/ holds unit/integration tests per
 * feature — realtime (see .docs/realtime-testing.md) and the document centre
 * (see .docs/document-centre.md § Companion tests).
 */

import nextJest from 'next/jest.js';

const createJestConfig = nextJest({ dir: './' });

export default createJestConfig({
  testEnvironment: 'jsdom',
  roots: ['<rootDir>/__tests__'],
  clearMocks: true,
  // next/jest does not derive this from tsconfig `paths` here — map it by hand.
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/$1' },
});
