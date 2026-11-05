import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@oakestra/ui';

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
      <UiTable
        entries={shipped}
        testId="preset-uis"
        title="Part of this deployment"
        description="These UIs ship with this deployment's preset. They are not installed through the addons manager, so they cannot be disabled or removed here. Use the nav item keys in the preset's nav.items to rename, move or hide their sidebar entries."
      />
      <UiTable
        entries={others}
        testId="unmatched-uis"
        title="Dashboard UIs without an installed addon"
        description="These UIs are loaded in this browser tab but no installed addon belongs to them, for example a dev override."
      />
    </>
  );
}

function UiTable({
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
    <section data-testid={testId} className="space-y-2">
      <div>
        <h2 className="text-sm font-semibold">{title}</h2>
        <p className="text-muted-foreground text-sm">{description}</p>
      </div>
      <div className="rounded-lg border px-2">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Addon</TableHead>
              <TableHead>Version</TableHead>
              <TableHead>State</TableHead>
              <TableHead>SDK range</TableHead>
              <TableHead>Details</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.map((entry) => (
              <TableRow key={entry.name} data-testid={`unmatched-ui-${entry.name}`}>
                <TableCell>
                  <span className="font-medium">{addonLabel(entry)}</span>
                  {addonLabel(entry) !== entry.name ? (
                    <span className="text-muted-foreground block font-mono text-xs">
                      {entry.name}
                    </span>
                  ) : null}
                </TableCell>
                <TableCell>{entry.version}</TableCell>
                <TableCell>
                  <DashboardUiBadge entry={entry} />
                </TableCell>
                <TableCell className="font-mono text-xs">{entry.sdk}</TableCell>
                <TableCell className="text-muted-foreground max-w-xs text-sm break-words whitespace-normal">
                  {dashboardUiProblem(entry) ?? ''}
                  <NavItemKeys entry={entry} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </section>
  );
}
