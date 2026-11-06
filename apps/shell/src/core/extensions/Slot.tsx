import type {
  EmptyContext,
  ExtensionPoints,
  RenderablePointId,
  SlotProps as SdkSlotProps,
} from '@oakestra/dashboard-sdk';
import { Fragment, type ComponentType } from 'react';

import { ContributionBoundary } from './ContributionBoundary';
import { useContributions } from './use-contributions';

export type SlotProps<P extends RenderablePointId> = SdkSlotProps<P> & {
  /**
   * Renders only the contributions it accepts, for a page that lays one point out in several
   * places (the overview by widget size). Shell only: the SDK's Slot has no such prop.
   */
  filter?: (item: ExtensionPoints[P]) => boolean;
};

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
  const { point, render, empty = null, wrap, filter } = props;
  const context = props.context ?? NO_CONTEXT;
  const all = useContributions(point, context);
  const contributions = filter ? all.filter(({ item }) => filter(item)) : all;
  // A crash belongs to what the contribution was showing: moving from one cluster to the next on
  // the same page keeps this component mounted, so the context has to clear the error. Slot
  // contexts are plain ids, and callers often build them inline, so compare by value.
  const contextKey = JSON.stringify(context);

  if (contributions.length === 0) return <>{empty}</>;

  const rendered = contributions.map(({ item, source }) => {
    // Every renderable point has a `component` taking that point's context. TypeScript cannot
    // follow that through the generic union, hence the cast.
    const { id, component: Contribution } = item as {
      id: string;
      component: ComponentType<object>;
    };
    const content = (
      <ContributionBoundary source={source} label={labelOf(item)} resetKey={contextKey}>
        <Contribution {...context} />
      </ContributionBoundary>
    );
    return (
      <Fragment key={`${source.kind}:${source.id}:${id}`}>
        {render ? render(item, content, source) : content}
      </Fragment>
    );
  });
  return <>{wrap ? wrap(rendered) : rendered}</>;
}
