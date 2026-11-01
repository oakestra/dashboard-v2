import type { ComponentType } from 'react';

import type { CurrentUser, Role } from './types';

export type NavGroup = 'main' | 'management' | 'addons';

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
}

interface RenderableContribution<C extends object> extends ContributionBase {
  component: ComponentType<C>;
  /** Extra visibility check on top of `roles`, evaluated with the slot's context. */
  visible?: (context: C, user: CurrentUser | null) => boolean;
}

export interface Widget<C extends object = EmptyContext> extends RenderableContribution<C> {
  title: string;
}

export interface Tab<C extends object> extends RenderableContribution<C> {
  label: string;
}

export interface Panel<C extends object = EmptyContext> extends RenderableContribution<C> {
  title: string;
  description?: string;
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
  'settings.panels': Panel;
}

export type ExtensionPointId = keyof ExtensionPoints;

export const EXTENSION_POINT_IDS = [
  'nav.items',
  'home.widgets',
  'application.detail.tabs',
  'service.detail.tabs',
  'cluster.widgets',
  'settings.panels',
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
