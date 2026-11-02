import type {
  EmptyContext,
  ExtensionPoints,
  RenderablePointId,
  SlotContext,
} from '@oakestra/dashboard-sdk';
import { Fragment, type ComponentType, type ReactNode } from 'react';

import { ContributionBoundary } from './ContributionBoundary';
import type { ContributionSource } from './registry';
import { useContributions } from './use-contributions';

type ContextProp<P extends RenderablePointId> =
  EmptyContext extends SlotContext<P> ? { context?: SlotContext<P> } : { context: SlotContext<P> };

export type SlotProps<P extends RenderablePointId> = {
  point: P;
  /**
   * Wraps each rendered contribution, e.g. in a card or a tab panel. `content` is already isolated
   * by an error boundary, so a wrapper can never be broken by the contribution it wraps.
   */
  render?: (item: ExtensionPoints[P], content: ReactNode, source: ContributionSource) => ReactNode;
  /** Rendered when nothing is contributed (or nothing is visible to the current user). */
  empty?: ReactNode;
} & ContextProp<P>;

// Shared so a slot without context passes the same object every render; a fresh `{}` would
// defeat the memo in useContributions.
const NO_CONTEXT: EmptyContext = Object.freeze({});

function labelOf(item: object): string {
  for (const key of ['title', 'label'] as const) {
    if (key in item) {
      const value = (item as Record<typeof key, unknown>)[key];
      if (typeof value === 'string') return value;
    }
  }
  return 'Contribution';
}

export function Slot<P extends RenderablePointId>(props: SlotProps<P>) {
  const { point, render, empty = null } = props;
  const context = props.context ?? NO_CONTEXT;
  const contributions = useContributions(point, context);

  if (contributions.length === 0) return <>{empty}</>;

  return (
    <>
      {contributions.map(({ item, source }) => {
        // Every renderable point has a `component` taking that point's context. TypeScript cannot
        // follow that through the generic union, hence the cast.
        const { id, component: Contribution } = item as {
          id: string;
          component: ComponentType<object>;
        };
        const content = (
          <ContributionBoundary source={source} label={labelOf(item)}>
            <Contribution {...context} />
          </ContributionBoundary>
        );
        return (
          <Fragment key={`${source.kind}:${source.id}:${id}`}>
            {render ? render(item, content, source) : content}
          </Fragment>
        );
      })}
    </>
  );
}
