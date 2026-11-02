import { describe, expectTypeOf, it } from 'vitest';

import { defineAddon } from './define-addon';
import type { ExtensionPointId, RenderablePointId, SlotContext } from './extension-points';

describe('extension point types', () => {
  it('treats every point except nav items as renderable', () => {
    expectTypeOf<RenderablePointId>().toEqualTypeOf<Exclude<ExtensionPointId, 'nav.items'>>();
  });

  it('derives the slot context from the point', () => {
    expectTypeOf<SlotContext<'service.detail.tabs'>>().toEqualTypeOf<{
      applicationId: string;
      serviceId: string;
    }>();
    expectTypeOf<SlotContext<'cluster.widgets'>>().toEqualTypeOf<{ clusterId: string }>();
  });

  it('type-checks contributed components against their point context', () => {
    defineAddon({
      id: 'typed',
      contributions: {
        'cluster.widgets': [
          { id: 'ok', title: 'OK', component: ({ clusterId }: { clusterId: string }) => clusterId },
        ],
        'service.detail.tabs': [
          {
            id: 'wrong',
            label: 'Wrong',
            // @ts-expect-error a service tab does not receive a clusterId
            component: ({ clusterId }: { clusterId: string }) => clusterId,
          },
        ],
      },
    });
  });
});
