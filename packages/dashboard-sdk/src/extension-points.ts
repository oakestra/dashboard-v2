import type { QueryClient } from '@tanstack/react-query';
import type { ComponentType } from 'react';

import type { CurrentUser, Notify, OakestraApi, Role } from './types';

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

/** The contributing addon, as a command sees it. See `CommandContext.addon`. */
export interface CommandAddon {
  readonly addonId: string;
  /** Absolute path the addon's routes are mounted at. Build links with `path`, not from this. */
  readonly basePath: string;
  /**
   * Absolute path below the addon's base path, like `useAddonPath()`: each argument is one
   * URI-encoded segment, so pass `'details', id`, not `'details/' + id`.
   */
  readonly path: (...segments: readonly (string | number)[]) => string;
}

/**
 * What the shell hands to `run` and `search`. These are plain functions called from the palette,
 * outside any addon's React tree, so hooks are not available: everything they would return is
 * here instead.
 */
export interface CommandContext {
  /**
   * Goes to a page. `path` must be absolute (`/applications`, or `ctx.addon.path(...)`); there is
   * no current route to resolve a relative path against, so anything else throws.
   */
  readonly navigate: (path: string) => void;
  readonly api: OakestraApi;
  readonly notify: Notify;
  /** Never null: the palette only exists behind the login. */
  readonly user: CurrentUser;
  /**
   * The shell's shared client. Read through it (`readCached` with the SDK's platform queries, or
   * your own keys from `addonQueryKey`) so that a search per keystroke does not mean a request per
   * keystroke.
   */
  readonly queryClient: QueryClient;
  /** Same answer as `useFeatureEnabled(id)`. */
  readonly isFeatureEnabled: (id: string) => boolean;
  /** Set for everything an addon or `modules/*` package contributes, absent for core modules. */
  readonly addon?: CommandAddon;
}

/**
 * What selecting an entry of the palette does: exactly one of the two.
 *
 * - `path` opens a page.
 * - `run` calls a function after the palette has closed. It may be async. If it throws or rejects,
 *   the shell shows the error as a notification, so there is no need to catch just to report.
 */
export type CommandTarget =
  | { path: string; run?: never }
  | { run: (ctx: CommandContext) => void | Promise<void>; path?: never };

/** How an entry of the palette reads. */
export interface CommandDisplay {
  /** Written as what happens or what it is, e.g. `New application`. */
  label: string;
  /** Second line, for what the label leaves open. */
  description?: string;
  icon?: ComponentType<IconProps>;
}

/**
 * Something that can always be done, listed in the palette and matched against what the user
 * types by the shell. For things that exist in the data, such as one application, use a
 * `CommandSource`.
 *
 * `path` follows the rules of nav items: core modules use absolute paths, addons paths relative to
 * their base path, where `''` is the addon's index route, `?tab=logs` that route with a query, and
 * `..` is rejected. `roles` hides the action from everyone else, like any contribution.
 *
 * ```ts
 * 'command.actions': [
 *   { id: 'jobs', label: 'Open job history', keywords: ['runs'], path: 'jobs' },
 *   { id: 'sync', label: 'Sync now', roles: ['Admin'], run: (ctx) => ctx.notify.info('Syncing') },
 * ]
 * ```
 */
export type CommandAction = ContributionBase &
  CommandDisplay & {
    /** More words that should find it, e.g. `['create', 'add']`. They are never shown. */
    keywords?: readonly string[];
  } & CommandTarget;

/**
 * Marks a result as abnormal, shown as a status glyph in front of it. Leave it out for everything
 * that is fine: as on the pages, only what needs attention stands out.
 */
export type CommandResultTone = 'warning' | 'destructive';

/**
 * One entry a `CommandSource` found. Unlike an action, a `path` here is always absolute: use
 * `ctx.addon.path(...)`. The shell checks every result when it arrives and drops the ones that are
 * malformed or lead to another origin, with a warning in the console.
 */
export type CommandResult = CommandDisplay & {
  /** Unique among the results of one search. */
  id: string;
  tone?: CommandResultTone;
} & CommandTarget;

/**
 * Searches something only its contributor knows about. The results form a group of their own in
 * the palette, in the order returned, below the shell's own groups. A deployment that leaves the
 * package out loses the search along with it.
 *
 * ```ts
 * 'command.sources': [
 *   {
 *     id: 'jobs',
 *     label: 'Jobs',
 *     search: async (query, { addon, api, queryClient }) => {
 *       if (!addon) return [];
 *       const jobs = await queryClient.ensureQueryData(jobsQuery(api));
 *       return jobs
 *         .filter((job) => job.name.includes(query))
 *         .map((job) => ({ id: job.id, label: job.name, path: addon.path('jobs', job.id) }));
 *     },
 *   },
 * ]
 * ```
 */
export interface CommandSource extends ContributionBase {
  /** Heading of the group, also how an error names it ("Jobs could not be searched"). */
  label: string;
  /** Shorter queries do not call `search`. Defaults to 2, at least 1. */
  minQueryLength?: number;
  /**
   * Called with what the user typed, trimmed, once typing pauses. Matching is up to the source,
   * the shell shows what it returns as it is.
   *
   * It has about five seconds. A source that rejects or takes longer shows a short notice and
   * leaves the other groups alone. `signal` aborts when the query changes or the time is up: pass
   * it to `fetch` and to `api` calls.
   */
  search: (
    query: string,
    ctx: CommandContext,
    signal: AbortSignal,
  ) => Promise<readonly CommandResult[]>;
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
  /** Entries of the "Find or run anything" palette. See `CommandAction`. */
  'command.actions': CommandAction;
  /** Live searches of the same palette. See `CommandSource`. */
  'command.sources': CommandSource;
}

export type ExtensionPointId = keyof ExtensionPoints;

export const EXTENSION_POINT_IDS = [
  'nav.items',
  'home.widgets',
  'application.detail.tabs',
  'service.detail.tabs',
  'cluster.widgets',
  'command.actions',
  'command.sources',
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
