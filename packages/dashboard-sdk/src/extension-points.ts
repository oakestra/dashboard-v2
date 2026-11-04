import type { ComponentType } from 'react';

import type { CurrentUser, Role } from './types';

/**
 * Where a nav item goes. `main`, `management` and `addons` are labelled groups in that order;
 * `footer` is pinned to the bottom of the sidebar, for items like Help and Settings that are
 * reached from every page but are not part of the daily work.
 */
export type NavGroup = 'main' | 'management' | 'addons' | 'footer';

/** Context-free slots still pass an (empty) object, so components can always spread props. */
export type EmptyContext = Record<never, never>;

export interface ContributionBase {
  /** Unique within the contributing addon or core module. */
  id: string;
  /** Lower comes first. Contributions without an order are placed after ordered ones. */
  order?: number;
  /** If set, only users holding at least one of these roles see the contribution. */
  roles?: readonly Role[];
}

export interface IconProps {
  className?: string;
}

export interface NavItem extends ContributionBase {
  label: string;
  /**
   * Target of the link. Core modules use absolute paths. Addon nav items are resolved relative to
   * the addon's base path (`/addons/<id>/`), so `''` points at the addon's index route.
   */
  path: string;
  icon?: ComponentType<IconProps>;
  group?: NavGroup;
  /**
   * Sub-items shown nested under this item. The sidebar has one level of nesting only, so a
   * sub-item has no children, icon or group of its own.
   */
  children?: readonly NavSubItem[];
}

/** A nested sidebar link. `id` is unique among the siblings, `path` follows the parent's rules. */
export interface NavSubItem extends ContributionBase {
  label: string;
  path: string;
}

interface RenderableContribution<C extends object> extends ContributionBase {
  component: ComponentType<C>;
  /** Extra visibility check on top of `roles`, evaluated with the slot's context. */
  visible?: (context: C, user: CurrentUser | null) => boolean;
}

/**
 * Where a widget goes on the overview page (`home.widgets`):
 *
 * - `stat`: a tile in the summary row at the top. The component draws the whole tile itself,
 *   usually a `StatCard`; `title` only names it in error messages.
 * - `wide`: a full-width section below the summary row. The component draws its own frame,
 *   usually a `SectionCard`, so it can have a description and actions; `title` only names it.
 * - `card` (the default): a cell of the widget grid at the bottom, inside a card titled `title`.
 *
 * Other slots that take widgets (`cluster.widgets`) ignore it and render every widget as a card.
 * So do shells that predate it (they drop fields they do not know), and a shell that gets a value
 * it does not know renders a `card`: draw a `stat` or `wide` widget so it still reads inside one.
 */
export type WidgetSize = 'stat' | 'card' | 'wide';

export interface Widget<C extends object = EmptyContext> extends RenderableContribution<C> {
  title: string;
  /** Layout hint for the overview page, see `WidgetSize`. Defaults to `card`. */
  size?: WidgetSize;
}

export interface Tab<C extends object> extends RenderableContribution<C> {
  label: string;
}

export interface ApplicationContext {
  applicationId: string;
}

export interface ServiceContext {
  applicationId: string;
  serviceId: string;
}

export interface ClusterContext {
  clusterId: string;
}

/**
 * Every place in the shell that accepts contributions, keyed by a stable id.
 *
 * Adding a key is a minor SDK release. Renaming or removing one, or changing a context type in an
 * incompatible way, is a major release.
 */
export interface ExtensionPoints {
  'nav.items': NavItem;
  'home.widgets': Widget;
  'application.detail.tabs': Tab<ApplicationContext>;
  'service.detail.tabs': Tab<ServiceContext>;
  'cluster.widgets': Widget<ClusterContext>;
}

export type ExtensionPointId = keyof ExtensionPoints;

export const EXTENSION_POINT_IDS = [
  'nav.items',
  'home.widgets',
  'application.detail.tabs',
  'service.detail.tabs',
  'cluster.widgets',
] as const satisfies readonly ExtensionPointId[];

// Compile-time guard: fails if a point is added to the interface but not to the runtime list.
type MissingPointIds = Exclude<ExtensionPointId, (typeof EXTENSION_POINT_IDS)[number]>;
const assertAllPointsListed: [MissingPointIds] extends [never] ? true : MissingPointIds = true;
void assertAllPointsListed;

/** Extension points whose contributions render a component, i.e. everything a `<Slot>` can host. */
export type RenderablePointId = {
  [P in ExtensionPointId]: ExtensionPoints[P] extends { component: unknown } ? P : never;
}[ExtensionPointId];

/** Props a slot passes to each contributed component. */
export type SlotContext<P extends RenderablePointId> =
  ExtensionPoints[P] extends RenderableContribution<infer C> ? C : never;

export type Contributions = {
  readonly [P in ExtensionPointId]?: readonly ExtensionPoints[P][];
};
