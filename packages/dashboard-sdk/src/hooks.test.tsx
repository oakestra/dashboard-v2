import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { AddonContext, HostContext, type HostContextValue } from './context';
import {
  addonQueryKey,
  useAddonBasePath,
  useCurrentUser,
  useHostContext,
  usePermissions,
} from './hooks';
import { hasAnyRole } from './permissions';
import type { CurrentUser, OakestraApi } from './types';

const user: CurrentUser = {
  username: 'alice',
  roles: ['Application_Provider'],
  organization: null,
};

function host(overrides: Partial<HostContextValue> = {}): HostContextValue {
  return {
    sdkVersion: '0.1.0',
    user,
    // The hooks only hand the object through; none of its endpoints are called here.
    api: { baseUrl: 'http://api', fetch: vi.fn() } as unknown as OakestraApi,
    notify: { success: vi.fn(), info: vi.fn(), warning: vi.fn(), error: vi.fn() },
    ...overrides,
  };
}

function withHost(value: HostContextValue) {
  return ({ children }: { children: ReactNode }) => (
    <HostContext.Provider value={value}>{children}</HostContext.Provider>
  );
}

describe('host hooks', () => {
  it('fail loudly outside the shell', () => {
    // React logs the thrown error; keep the test output readable.
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => renderHook(() => useHostContext())).toThrow(
      /outside the Oakestra dashboard shell/,
    );
  });

  it('expose the current user', () => {
    const { result } = renderHook(() => useCurrentUser(), { wrapper: withHost(host()) });
    expect(result.current).toBe(user);
  });

  it('derive permissions from the user roles', () => {
    const { result } = renderHook(() => usePermissions(), { wrapper: withHost(host()) });
    expect(result.current.hasRole('Application_Provider')).toBe(true);
    expect(result.current.hasRole('Admin')).toBe(false);
    expect(result.current.hasAnyRole(['Admin', 'Application_Provider'])).toBe(true);
  });

  it('give an anonymous user no roles', () => {
    const { result } = renderHook(() => usePermissions(), {
      wrapper: withHost(host({ user: null })),
    });
    expect(result.current.roles).toEqual([]);
    expect(result.current.hasRole('Admin')).toBe(false);
  });
});

describe('addon hooks', () => {
  it('read the base path from the addon context', () => {
    const { result } = renderHook(() => useAddonBasePath(), {
      wrapper: ({ children }) => (
        <AddonContext.Provider
          value={{ addonId: 'flops', version: '1.0.0', basePath: '/addons/flops' }}
        >
          {children}
        </AddonContext.Provider>
      ),
    });
    expect(result.current).toBe('/addons/flops');
  });

  it('namespace query keys by addon', () => {
    expect(addonQueryKey('flops', 'jobs', 3)).toEqual(['addon', 'flops', 'jobs', 3]);
  });
});

describe('hasAnyRole', () => {
  it('treats a missing or empty role list as public', () => {
    expect(hasAnyRole(null, undefined)).toBe(true);
    expect(hasAnyRole(null, [])).toBe(true);
  });

  it('never matches an anonymous user against a restricted list', () => {
    expect(hasAnyRole(null, ['Admin'])).toBe(false);
  });
});
