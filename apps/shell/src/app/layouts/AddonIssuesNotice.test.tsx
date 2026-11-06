import { HostContext, type HostContextValue, type OakestraApi } from '@oakestra/dashboard-sdk';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createAddonRegistry,
  setEntry,
  type AddonEntry,
  type AddonRegistry,
} from '../../core/addons/addon-registry';
import { AddonRegistryContext } from '../../core/addons/addon-registry-context';
import { presetSchema, type PresetInput } from '../../core/config/preset';
import { PresetContext } from '../../core/config/preset-context';
import {
  ADDON_ISSUE_GRACE_MS,
  AddonIssuesNotice,
  DISMISSED_ADDON_ISSUES_KEY,
} from './AddonIssuesNotice';

const base = {
  version: '1.0.0',
  sdk: '^0.1.0',
  entry: 'http://x/mf-manifest.json',
  origin: 'manager' as const,
};

const failed = (name: string, extra: Partial<AddonEntry> = {}) =>
  ({
    ...base,
    name,
    basePath: `/addons/${name}`,
    state: 'failed',
    error: 'boom',
    ...extra,
  }) as AddonEntry;

const incompatible = (name: string) =>
  ({
    ...base,
    name,
    basePath: `/addons/${name}`,
    state: 'incompatible',
    error: 'needs ^9.0.0',
  }) as AddonEntry;

function renderNotice(
  registry: AddonRegistry,
  { roles = ['Admin'], preset = {} }: { roles?: string[]; preset?: PresetInput } = {},
) {
  const host = {
    user: { username: 'u', roles, organization: null },
    api: {} as OakestraApi,
  } as unknown as HostContextValue;
  return render(
    <HostContext.Provider value={host}>
      <PresetContext.Provider value={presetSchema.parse(preset)}>
        <AddonRegistryContext.Provider value={registry}>
          <MemoryRouter>
            <AddonIssuesNotice />
          </MemoryRouter>
        </AddonRegistryContext.Provider>
      </PresetContext.Provider>
    </HostContext.Provider>,
  );
}

const notice = () => screen.queryByTestId('addon-issues-notice');
const advance = (ms: number) => {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
};
const passGrace = () => advance(ADDON_ISSUE_GRACE_MS);
const update = (registry: AddonRegistry, entry: AddonEntry) => {
  act(() => setEntry(registry, entry));
};

describe('<AddonIssuesNotice>', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    window.sessionStorage.clear();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows a failed addon to admins only after the grace period', () => {
    const registry = createAddonRegistry();
    setEntry(registry, failed('flops'));
    renderNotice(registry);

    advance(ADDON_ISSUE_GRACE_MS - 1);
    expect(notice()).not.toBeInTheDocument();

    advance(1);
    expect(notice()).toHaveTextContent('flops failed to load.');
    expect(screen.getByRole('link', { name: 'Open addon manager' })).toHaveAttribute(
      'href',
      '/addon-manager/installed',
    );
  });

  it('does not restart the grace period while the loader retries with a new error', () => {
    const registry = createAddonRegistry();
    setEntry(registry, failed('flops'));
    renderNotice(registry);

    advance(ADDON_ISSUE_GRACE_MS / 2);
    update(registry, failed('flops', { error: 'another reason' }));
    advance(ADDON_ISSUE_GRACE_MS / 2);
    expect(notice()).toBeInTheDocument();
  });

  it('stays quiet for an addon that recovers within the grace period', () => {
    const registry = createAddonRegistry();
    setEntry(registry, failed('flops'));
    renderNotice(registry);

    advance(ADDON_ISSUE_GRACE_MS / 2);
    update(registry, {
      ...base,
      name: 'flops',
      basePath: '/addons/flops',
      state: 'loaded',
      definition: { id: 'flops' },
    });
    passGrace();
    expect(notice()).not.toBeInTheDocument();
  });

  it('shows an incompatible addon at once, since nothing retries it', () => {
    const registry = createAddonRegistry();
    setEntry(registry, incompatible('old'));
    renderNotice(registry);
    expect(notice()).toHaveTextContent('old is not compatible with this dashboard version.');
  });

  it('lists every addon with a problem in one notice', () => {
    const registry = createAddonRegistry();
    setEntry(registry, failed('flops'));
    setEntry(registry, incompatible('old'));
    renderNotice(registry);
    passGrace();
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    expect(screen.getAllByRole('link')).toHaveLength(1);
  });

  it('is not shown to other roles', () => {
    const registry = createAddonRegistry();
    setEntry(registry, incompatible('old'));
    renderNotice(registry, { roles: ['Application_Provider'] });
    expect(notice()).not.toBeInTheDocument();
  });

  it('is not shown when the preset leaves out the addon manager', () => {
    const registry = createAddonRegistry();
    setEntry(registry, incompatible('old'));
    renderNotice(registry, { preset: { modules: ['overview'] } });
    expect(notice()).not.toBeInTheDocument();
  });

  it('ignores linked addons, which the addon manager does not list', () => {
    const registry = createAddonRegistry();
    setEntry(registry, failed('help', { origin: 'linked' }));
    renderNotice(registry);
    passGrace();
    expect(notice()).not.toBeInTheDocument();
  });

  it('stays dismissed for the session, but not for a new problem', () => {
    const registry = createAddonRegistry();
    setEntry(registry, incompatible('old'));
    const { unmount } = renderNotice(registry);

    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(notice()).not.toBeInTheDocument();
    expect(window.sessionStorage.getItem(DISMISSED_ADDON_ISSUES_KEY)).toContain('old@1.0.0');

    unmount();
    renderNotice(registry);
    expect(notice()).not.toBeInTheDocument();

    update(registry, incompatible('other'));
    expect(notice()).toHaveTextContent('other is not compatible');
    expect(notice()).not.toHaveTextContent('old');
  });

  it('still works when storage is unavailable', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('denied');
    });
    const registry = createAddonRegistry();
    setEntry(registry, incompatible('old'));
    renderNotice(registry);

    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(notice()).not.toBeInTheDocument();
    vi.restoreAllMocks();
  });
});
