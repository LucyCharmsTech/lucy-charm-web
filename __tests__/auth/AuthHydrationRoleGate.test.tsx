import type * as ReactModule from 'react';
import type { createRoot as createRootType } from 'react-dom/client';
import type RoleGateType from '@/components/portals/RoleGate';
import type { useAuthStore as useAuthStoreType } from '@/stores/authStore';
import type { AuthUser } from '@/types/api';

const mockReplace = jest.fn();
let mockPath = '/agent';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace }),
  usePathname: () => mockPath,
}));

function persistedSession(user?: AuthUser) {
  localStorage.setItem(
    'lucy-auth',
    JSON.stringify({
      state: user
        ? { accessToken: 'persisted-access', refreshToken: 'persisted-refresh', user }
        : {},
      version: 0,
    }),
  );
}

function loadRealStoreAndGate() {
  let React!: typeof ReactModule;
  let createRoot!: typeof createRootType;
  let RoleGate!: typeof RoleGateType;
  let useAuthStore!: typeof useAuthStoreType;

  // Import after localStorage is prepared. This exercises Zustand's initial,
  // synchronous hydration rather than mocking hasHydrated() or rehydrating
  // after the store constant has already been initialized.
  jest.isolateModules(() => {
    React = jest.requireActual('react');
    ({ createRoot } = jest.requireActual('react-dom/client'));
    ({ useAuthStore } = jest.requireActual('@/stores/authStore'));
    ({ default: RoleGate } = jest.requireActual('@/components/portals/RoleGate'));
  });

  return { React, createRoot, RoleGate, useAuthStore };
}

function renderGate(
  modules: ReturnType<typeof loadRealStoreAndGate>,
  allowed: 'agent' | 'superadmin',
) {
  const { React, createRoot, RoleGate } = modules;
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);

  React.act(() => {
    root.render(
      <RoleGate allowed={allowed}>
        <span data-testid="protected-content">Protected content</span>
      </RoleGate>,
    );
  });

  return {
    container,
    cleanup: () => {
      React.act(() => root.unmount());
      container.remove();
    },
  };
}

const agent: AuthUser = {
  user_id: 'agent-id',
  email: 'agent@example.test',
  first_name: 'Agent',
  last_name: 'Example',
  role: 'agent',
};
const admin: AuthUser = { ...agent, user_id: 'admin-id', role: 'superadmin' };

beforeEach(() => {
  localStorage.clear();
  mockReplace.mockClear();
  mockPath = '/agent';
});

test('fresh visit completes real persistence hydration and redirects to login', () => {
  const modules = loadRealStoreAndGate();
  expect(modules.useAuthStore.persist.hasHydrated()).toBe(true);

  const view = renderGate(modules, 'agent');
  try {
    expect(view.container.textContent).not.toContain('Loading…');
    expect(mockReplace).toHaveBeenCalledWith('/login?redirect=%2Fagent');
    expect(view.container.querySelector('[data-testid="protected-content"]')).toBeNull();
  } finally {
    view.cleanup();
  }
});

test('persisted Agent session hydrates and mounts agent content', () => {
  persistedSession(agent);
  const modules = loadRealStoreAndGate();
  expect(modules.useAuthStore.persist.hasHydrated()).toBe(true);
  expect(modules.useAuthStore.getState().accessToken).toBe('persisted-access');

  const view = renderGate(modules, 'agent');
  try {
    expect(view.container.querySelector('[data-testid="protected-content"]')).not.toBeNull();
    expect(mockReplace).not.toHaveBeenCalled();
  } finally {
    view.cleanup();
  }
});

test('persisted Super Admin session hydrates and mounts admin content', () => {
  persistedSession(admin);
  mockPath = '/admin';
  const modules = loadRealStoreAndGate();
  expect(modules.useAuthStore.persist.hasHydrated()).toBe(true);

  const view = renderGate(modules, 'superadmin');
  try {
    expect(view.container.querySelector('[data-testid="protected-content"]')).not.toBeNull();
    expect(mockReplace).not.toHaveBeenCalled();
  } finally {
    view.cleanup();
  }
});

test('hydrated wrong role retains the existing redirect and does not mount content', () => {
  persistedSession(agent);
  mockPath = '/admin';
  const modules = loadRealStoreAndGate();
  expect(modules.useAuthStore.persist.hasHydrated()).toBe(true);

  const view = renderGate(modules, 'superadmin');
  try {
    expect(mockReplace).toHaveBeenCalledWith('/agent');
    expect(view.container.querySelector('[data-testid="protected-content"]')).toBeNull();
  } finally {
    view.cleanup();
  }
});

test('an empty persisted state still hydrates as signed out', () => {
  persistedSession();
  const modules = loadRealStoreAndGate();
  expect(modules.useAuthStore.persist.hasHydrated()).toBe(true);
  expect(modules.useAuthStore.getState().accessToken).toBeNull();

  const view = renderGate(modules, 'agent');
  try {
    expect(view.container.textContent).not.toContain('Loading…');
    expect(mockReplace).toHaveBeenCalledWith('/login?redirect=%2Fagent');
  } finally {
    view.cleanup();
  }
});

test('malformed persisted JSON is discarded and cannot trap the gate in loading', () => {
  localStorage.setItem('lucy-auth', '{not valid JSON');
  const modules = loadRealStoreAndGate();
  expect(modules.useAuthStore.persist.hasHydrated()).toBe(true);
  expect(modules.useAuthStore.getState().accessToken).toBeNull();
  expect(localStorage.getItem('lucy-auth')).toBeNull();

  const view = renderGate(modules, 'agent');
  try {
    expect(view.container.textContent).not.toContain('Loading…');
    expect(mockReplace).toHaveBeenCalledWith('/login?redirect=%2Fagent');
  } finally {
    view.cleanup();
  }
});

test('storage read and removal exceptions still hydrate signed out', () => {
  const read = jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
  const remove = jest.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => { throw new Error('blocked'); });
  try {
    const modules = loadRealStoreAndGate();
    expect(modules.useAuthStore.persist.hasHydrated()).toBe(true);
    expect(modules.useAuthStore.getState().accessToken).toBeNull();
    const view = renderGate(modules, 'agent');
    expect(mockReplace).toHaveBeenCalledWith('/login?redirect=%2Fagent');
    view.cleanup();
  } finally { read.mockRestore(); remove.mockRestore(); }
});

test('storage write and removal exceptions do not break runtime login or logout', () => {
  const write = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
  const remove = jest.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => { throw new Error('blocked'); });
  try {
    const modules = loadRealStoreAndGate();
    modules.useAuthStore.getState().setAuth('access', 'refresh', agent);
    expect(modules.useAuthStore.getState().isAuthenticated()).toBe(true);
    modules.useAuthStore.getState().clearAuth();
    expect(modules.useAuthStore.getState().isAuthenticated()).toBe(false);
  } finally { write.mockRestore(); remove.mockRestore(); }
});

test('restricted localStorage getter cannot trap hydration', () => {
  const descriptor = Object.getOwnPropertyDescriptor(window, 'localStorage');
  Object.defineProperty(window, 'localStorage', { configurable: true, get: () => { throw new Error('restricted'); } });
  try {
    const modules = loadRealStoreAndGate();
    expect(modules.useAuthStore.persist.hasHydrated()).toBe(true);
    expect(modules.useAuthStore.getState().accessToken).toBeNull();
  } finally { if (descriptor) Object.defineProperty(window, 'localStorage', descriptor); }
});

test('a structurally invalid persisted identity cannot authenticate', () => {
  localStorage.setItem('lucy-auth', JSON.stringify({
    state: { accessToken: 'access', refreshToken: 'refresh', user: { user_id: 'u', role: 'unknown' } }, version: 0,
  }));
  const modules = loadRealStoreAndGate();
  expect(modules.useAuthStore.persist.hasHydrated()).toBe(true);
  expect(modules.useAuthStore.getState().accessToken).toBeNull();
});
