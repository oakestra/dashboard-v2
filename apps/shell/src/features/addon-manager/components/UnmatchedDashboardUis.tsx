import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@oakestra/ui';

import { addonLabel, type AddonEntry } from '../../../core/addons/addon-registry';
import { DashboardUiBadge, dashboardUiProblem } from './DashboardUiBadge';

/**
 * Addon UIs the shell runs that no installed addon explains, e.g. a dev override pointing at a
 * local Vite server. Without this section they would appear nowhere in the addon manager.
 */
export function UnmatchedDashboardUis({ entries }: { entries: readonly AddonEntry[] }) {
  if (entries.length === 0) return null;

  return (
    <Card data-testid="unmatched-uis">
      <CardHeader>
        <CardTitle>Dashboard UIs without an installed addon</CardTitle>
        <CardDescription>
          These UIs are loaded in this browser tab but no installed addon belongs to them, for
          example a dev override.
        </CardDescription>
      </CardHeader>
      <CardContent>
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
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
