import { Item, ItemContent, ItemDescription, ItemTitle } from '@oakestra/ui';

import { addonLabel, type AddonEntry } from '../../../core/addons/addon-registry';
import { DashboardUiBadge, dashboardUiProblem } from './DashboardUiBadge';
import { NavItemKeys } from './NavItemKeys';

/**
 * Addon UIs the shell runs that no installed addon explains. Two kinds: UIs the deployment preset
 * ships (not managed here, so there is nothing to disable or remove) and everything else, e.g. a
 * dev override pointing at a local Vite server. Without this section they would appear nowhere in
 * the addon manager.
 */
export function UnmatchedDashboardUis({ entries }: { entries: readonly AddonEntry[] }) {
  const shipped = entries.filter((entry) => entry.origin === 'preset');
  const others = entries.filter((entry) => entry.origin !== 'preset');

  return (
    <>
      <UiList
        entries={shipped}
        testId="preset-uis"
        title="Part of this deployment"
        description="These UIs ship with this deployment's preset. They are not installed through the addons manager, so they cannot be disabled or removed here. Use the nav item keys in the preset's nav.items to rename, move or hide their sidebar entries."
      />
      <UiList
        entries={others}
        testId="unmatched-uis"
        title="Dashboard UIs without an installed addon"
        description="These UIs are loaded in this browser tab but no installed addon belongs to them, for example a dev override."
      />
    </>
  );
}

function UiList({
  entries,
  testId,
  title,
  description,
}: {
  entries: readonly AddonEntry[];
  testId: string;
  title: string;
  description: string;
}) {
  if (entries.length === 0) return null;

  return (
    <section data-testid={testId} className="space-y-3">
      <div>
        <h2 className="text-sm font-semibold">{title}</h2>
        <p className="text-muted-foreground text-sm">{description}</p>
      </div>
      <ul
        aria-label={title}
        className="bg-card divide-y overflow-hidden rounded-lg border shadow-xs"
      >
        {entries.map((entry) => {
          const problem = dashboardUiProblem(entry);
          return (
            <li key={entry.name}>
              <Item data-testid={`unmatched-ui-${entry.name}`}>
                <ItemContent className="basis-64">
                  <ItemTitle>{addonLabel(entry)}</ItemTitle>
                  {addonLabel(entry) !== entry.name ? (
                    <div className="text-muted-foreground truncate font-mono text-xs">
                      {entry.name}
                    </div>
                  ) : null}
                  {problem ? (
                    <ItemDescription className="break-words">{problem}</ItemDescription>
                  ) : null}
                  <NavItemKeys entry={entry} />
                </ItemContent>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                  <span className="text-muted-foreground tabular-nums">
                    Version {entry.version}
                  </span>
                  <span className="text-muted-foreground">
                    SDK <span className="font-mono text-xs">{entry.sdk}</span>
                  </span>
                  <DashboardUiBadge entry={entry} />
                </div>
              </Item>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
