import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { AddonContext, HostContext, type HostContextValue } from './context';
import {
  addonQueryKey,
  buildAddonPath,
  useAddonBasePath,
  useAddonPath,
  useCurrentUser,
  useFeatureEnabled,
  useHostContext,
  useHostLinks,
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
    addonBackendFetch: vi.fn(),
    isFeatureEnabled: () => true,
    links: {},
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

  it('ask the shell which features are enabled', () => {
    const isFeatureEnabled = (id: string) => id === 'applications';
    const wrapper = withHost(host({ isFeatureEnabled }));
    expect(renderHook(() => useFeatureEnabled('applications'), { wrapper }).result.current).toBe(
      true,
    );
    expect(renderHook(() => useFeatureEnabled('help'), { wrapper }).result.current).toBe(false);
  });

  it('hand out the links the deployment configures', () => {
    const wrapper = withHost(host({ links: { grafanaUrl: 'https://grafana.example' } }));
    expect(renderHook(() => useHostLinks(), { wrapper }).result.current).toEqual({
      grafanaUrl: 'https://grafana.example',
    });
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

function withAddon({ children }: { children: ReactNode }) {
  return (
    <AddonContext.Provider
      value={{ addonId: 'flops', version: '1.0.0', basePath: '/addons/flops' }}
    >
      {children}
    </AddonContext.Provider>
  );
}

describe('addon hooks', () => {
  it('read the base path from the addon context', () => {
    const { result } = renderHook(() => useAddonBasePath(), { wrapper: withAddon });
    expect(result.current).toBe('/addons/flops');
  });

  it('build paths below the base path with one encoded segment per argument', () => {
    const { result } = renderHook(() => useAddonPath(), { wrapper: withAddon });
    const addonPath = result.current;
    expect(addonPath()).toBe('/addons/flops');
    expect(addonPath('')).toBe('/addons/flops');
    expect(addonPath('details', 42)).toBe('/addons/flops/details/42');
    expect(addonPath('details', 'a/b c?d#e')).toBe('/addons/flops/details/a%2Fb%20c%3Fd%23e');
  });

  it('build the same paths without a hook', () => {
    expect(buildAddonPath('/fleet')).toBe('/fleet');
    expect(buildAddonPath('/fleet', '', 'a/b', 42)).toBe('/fleet/a%2Fb/42');
  });

  it('keep the path builder stable across renders', () => {
    const { result, rerender } = renderHook(() => useAddonPath(), { wrapper: withAddon });
    const first = result.current;
    rerender();
    expect(result.current).toBe(first);
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
