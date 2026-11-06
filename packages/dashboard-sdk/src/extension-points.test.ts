import { describe, expectTypeOf, it } from 'vitest';

import { defineAddon } from './define-addon';
import type {
  CommandAction,
  CommandContext,
  ExtensionPointId,
  RenderablePointId,
  SlotContext,
} from './extension-points';

describe('extension point types', () => {
  it('treats every point except nav items and commands as renderable', () => {
    expectTypeOf<RenderablePointId>().toEqualTypeOf<
      Exclude<ExtensionPointId, 'nav.items' | 'command.actions' | 'command.sources'>
    >();
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

  it('gives run and search the command context', () => {
    defineAddon({
      id: 'typed',
      contributions: {
        'command.actions': [
          { id: 'open', label: 'Open', path: 'jobs' },
          {
            id: 'run',
            label: 'Run',
            run: (ctx) => {
              expectTypeOf(ctx).toEqualTypeOf<CommandContext>();
            },
          },
        ],
        'command.sources': [{ id: 'none', label: 'None', search: () => Promise.resolve([]) }],
      },
    });
  });

  it('accepts a path or run on a command, never both or neither', () => {
    const run = () => undefined;
    // @ts-expect-error an action opens a page or runs a function
    const both: CommandAction = { id: 'both', label: 'Both', path: 'jobs', run };
    // @ts-expect-error an action has to do something
    const neither: CommandAction = { id: 'neither', label: 'Neither' };
    void [both, neither];
  });
});
