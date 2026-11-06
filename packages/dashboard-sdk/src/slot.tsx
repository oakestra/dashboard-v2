import { createElement, useContext, type ReactNode } from 'react';

import { SlotRendererContext } from './context';
import type {
  EmptyContext,
  ExtensionPoints,
  RenderablePointId,
  SlotContext,
} from './extension-points';

/** Who contributed an item, as far as a `render` wrapper needs to know. */
export interface SlotSource {
  kind: 'core' | 'addon';
  id: string;
  label: string;
  /**
   * True for an addon loaded at runtime. Unset or false for everything built into the dashboard,
   * which `kind` cannot tell: first-party packages are of kind `addon` too.
   */
  remote?: boolean;
  /** The addon's name for people: its `label`, or its id when it declares none. */
  displayName?: string;
  /**
   * The installed version, for remote addons only. Packages built into the dashboard have no
   * version of their own to show.
   */
  version?: string;
}

type ContextProp<P extends RenderablePointId> =
  EmptyContext extends SlotContext<P> ? { context?: SlotContext<P> } : { context: SlotContext<P> };

export type SlotProps<P extends RenderablePointId> = {
  point: P;
  /**
   * Wraps each rendered contribution, e.g. in a card or a tab panel. `content` is already isolated
   * by an error boundary, so a wrapper can never be broken by the contribution it wraps.
   */
  render?: (item: ExtensionPoints[P], content: ReactNode, source: SlotSource) => ReactNode;
  /** Rendered when nothing is contributed (or nothing is visible to the current user). */
  empty?: ReactNode;
  /**
   * Wraps all rendered contributions together, and only when there is at least one. For chrome
   * that must not appear for an empty slot, such as a tab list whose only tab would be the page's
   * own (`empty` then holds the page without tabs).
   */
  wrap?: (children: ReactNode) => ReactNode;
} & ContextProp<P>;

/**
 * Hosts an extension point inside an addon page, so other addons and the shell can contribute to
 * it. The shell supplies the renderer; outside a host (a plain unit test) there is nobody to
 * contribute, so it renders `empty`.
 */
export function Slot<P extends RenderablePointId>(props: SlotProps<P>) {
  const renderer = useContext(SlotRendererContext);
  if (!renderer) return <>{props.empty ?? null}</>;
  // The renderer is typed over the union of all points; a call site's P is one member of it.
  // createElement because the renderer is a provided component, not one created in this render.
  return createElement(renderer, props as unknown as SlotProps<RenderablePointId>);
}
