import { http, HttpResponse } from '@oakestra/mocks';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { createStore } from 'zustand/vanilla';

import { mockServer } from '../../test/msw';
import { createTestConfig } from '../../test/render';
import { AuthSessionContext } from '../auth/auth-context';
import type { AuthSession } from '../auth/session';
import { ConfigContext } from '../config/config-context';
import { parsePreset, type PresetInput } from '../config/preset';
import { PresetContext } from '../config/preset-context';
import { createContributionRegistry } from '../extensions/registry';
import { ContributionRegistryContext } from '../extensions/registry-context';
import { createAddonRegistry } from './addon-registry';
import { AddonRegistryContext } from './addon-registry-context';
import { uiAddonsQueryKey, type UiAddon } from './ui-addons';
import { useAddonSync } from './use-addon-sync';

const runtime = vi.hoisted(() => ({
  register: vi.fn(),
  load: vi.fn((name: string) => Promise.resolve({ default: { id: name, label: `${name} UI` } })),
}));
vi.mock('./federation-runtime', () => ({ federationRuntime: runtime }));

const UI_ADDONS_URL = 'http://api.test/ui-addons';

const pinned = {
  name: 'acme',
  version: '2.0.0',
  sdk: '^0.1.0',
  entry: '/bundled-addons/acme/mf-manifest.json',
  mount: '/acme',
};

function Sync() {
  useAddonSync();
  return null;
}

function setup(preset: PresetInput, { loggedIn = true, pollIntervalMs = 60_000 } = {}) {
  const addons = createAddonRegistry();
  const queryClient = new QueryClient();
  // The hook only reads the session status.
  const session = {
    store: createStore(() => ({ status: loggedIn ? 'authenticated' : 'anonymous' })),
  } as unknown as AuthSession;
  render(
    <ConfigContext.Provider
      value={createTestConfig({ uiAddonsUrl: UI_ADDONS_URL, addonsPollIntervalMs: pollIntervalMs })}
    >
      <PresetContext.Provider value={parsePreset(preset)}>
        <AuthSessionContext.Provider value={session}>
          <QueryClientProvider client={queryClient}>
            <ContributionRegistryContext.Provider value={createContributionRegistry()}>
              <AddonRegistryContext.Provider value={addons}>
                <Sync />
              </AddonRegistryContext.Provider>
            </ContributionRegistryContext.Provider>
          </QueryClientProvider>
        </AuthSessionContext.Provider>
      </PresetContext.Provider>
    </ConfigContext.Provider>,
  );
  const entry = (name: string) => addons.getState().entries[name];
  return { addons, queryClient, entry };
}

function serveUiAddons(respond: () => UiAddon[] | Response) {
  const requests = vi.fn();
  mockServer.use(
    http.get(UI_ADDONS_URL, () => {
      requests();
      const body = respond();
      return body instanceof Response ? body : HttpResponse.json(body);
    }),
  );
  return requests;
}

describe('useAddonSync with a preset', () => {
  it('loads preset addons at their mount without asking the addons manager', async () => {
    const requests = serveUiAddons(() => []);
    const { addons, entry } = setup({ addonDiscovery: false, addons: [pinned] });

    await waitFor(() => expect(entry('acme')?.state).toBe('loaded'));
    expect(entry('acme')).toMatchObject({
      origin: 'preset',
      basePath: '/acme',
      entry: `${window.location.origin}/bundled-addons/acme/mf-manifest.json`,
    });
    expect(runtime.register).toHaveBeenCalledWith('acme', entry('acme')!.entry);
    expect(addons.getState().availability).toBe('disabled');
    expect(requests).not.toHaveBeenCalled();
  });

  it('retries a failed preset addon on the poll interval while discovery is off', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    runtime.load.mockRejectedValueOnce(new Error('server down'));
    const requests = serveUiAddons(() => []);
    const { entry } = setup({ addonDiscovery: false, addons: [pinned] }, { pollIntervalMs: 1000 });

    await waitFor(() => expect(entry('acme')?.state).toBe('failed'));
    await waitFor(() => expect(entry('acme')?.state).toBe('loaded'), { timeout: 3000 });
    expect(runtime.load).toHaveBeenCalledTimes(2);
    expect(requests).not.toHaveBeenCalled();
  });

  it('loads preset addons while /ui-addons fails', async () => {
    serveUiAddons(() => new HttpResponse(null, { status: 502 }));
    const { addons, entry } = setup({ addons: [pinned] });

    await waitFor(() => expect(addons.getState().availability).toBe('unavailable'));
    await waitFor(() => expect(entry('acme')?.state).toBe('loaded'));
  });

  it('pins preset addons over /ui-addons entries and keeps them when the list drops them', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    let list: UiAddon[] = [
      { name: 'acme', version: '9.9.9', sdk: '^0.1.0' },
      { name: 'other', version: '1.0.0', sdk: '^0.1.0' },
    ];
    serveUiAddons(() => list);
    const { queryClient, entry } = setup({ addons: [pinned] });

    await waitFor(() => expect(entry('other')?.state).toBe('loaded'));
    expect(entry('acme')).toMatchObject({ state: 'loaded', version: '2.0.0', origin: 'preset' });

    list = [];
    await queryClient.refetchQueries({ queryKey: uiAddonsQueryKey });
    await waitFor(() => expect(entry('other')).toBeUndefined());
    expect(entry('acme')?.state).toBe('loaded');
  });

  it('loads nothing before login', async () => {
    const requests = serveUiAddons(() => []);
    const { entry } = setup({ addonDiscovery: false, addons: [pinned] }, { loggedIn: false });

    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(entry('acme')).toBeUndefined();
    expect(requests).not.toHaveBeenCalled();
  });
});
