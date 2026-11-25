import { describe, expect, it } from 'vitest';

import { createAddonsBackend } from './addons-backend.ts';
import { withShowcaseAddons } from './showcase.ts';

const names = (list: readonly { name: string }[]) => list.map((addon) => addon.name);

describe('withShowcaseAddons', () => {
  it('serves example and carbon as ui addons, flops once installed', async () => {
    const backend = createAddonsBackend({
      uiBlockSupport: true,
      installDelayMs: 0,
      customize: withShowcaseAddons,
    });
    expect(names(backend.uiAddons())).toEqual(['example', 'carbon']);

    const flops = backend.state.marketplace.find((definition) => definition.name === 'flops')!;
    expect(backend.manager.install({ marketplace_id: flops._id }).status).toBe(201);
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(names(backend.uiAddons())).toEqual(['example', 'carbon', 'flops']);
  });

  it('drops the definitions that only exist for failure tests', () => {
    const backend = createAddonsBackend({ uiBlockSupport: true, customize: withShowcaseAddons });
    const marketplace = names(backend.state.marketplace);
    for (const name of ['flaky-addon', 'broken-addon', 'install-error-addon', 'rejected-addon']) {
      expect(marketplace).not.toContain(name);
    }
  });

  it('survives a reset', () => {
    const backend = createAddonsBackend({ uiBlockSupport: true, customize: withShowcaseAddons });
    backend.reset();
    expect(names(backend.uiAddons())).toEqual(['example', 'carbon']);
  });
});
