import type { AddonPermissions } from '@oakestra/api';
import { Badge, StatusBadge, cn, plural } from '@oakestra/ui';
import { ShieldAlertIcon } from 'lucide-react';

import { permissionEntries } from '../permissions';

interface PermissionListProps {
  permissions: AddonPermissions;
  /** What was granted before; entries beyond it are marked "New". */
  previous?: AddonPermissions;
}

/** Every permission with what it means, dangerous ones first and marked as such. */
export function PermissionList({ permissions, previous }: PermissionListProps) {
  const entries = permissionEntries(permissions, previous);
  if (entries.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        No special permissions: no host paths, host ports, host network or core network.
      </p>
    );
  }
  return (
    <ul className="divide-y rounded-md border" data-testid="permission-list">
      {entries.map((entry) => (
        <li
          key={entry.key}
          className={cn(
            'flex items-start gap-3 px-3 py-2 text-sm',
            entry.dangerous && 'bg-destructive/5',
          )}
          data-testid={`permission-${entry.key}`}
          data-dangerous={entry.dangerous || undefined}
        >
          {entry.dangerous ? (
            <ShieldAlertIcon className="text-destructive mt-0.5 size-4 shrink-0" aria-hidden />
          ) : (
            <span className="size-4 shrink-0" aria-hidden />
          )}
          <div className="min-w-0 flex-1">
            <p className="flex flex-wrap items-center gap-2 font-medium">
              <span
                className={entry.key.startsWith('host_paths:') ? 'font-mono text-xs' : undefined}
              >
                {entry.label}
              </span>
              {entry.dangerous ? <StatusBadge tone="destructive">Dangerous</StatusBadge> : null}
              {entry.added ? <Badge variant="secondary">New</Badge> : null}
            </p>
            <p className="text-muted-foreground text-xs">{entry.detail}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}

/** A compact summary for cards and rows: the dangerous permissions by name, the rest counted. */
export function PermissionBadges({ permissions }: { permissions: AddonPermissions }) {
  const entries = permissionEntries(permissions);
  const dangerous = entries.filter((entry) => entry.dangerous);
  const paths = permissions.host_paths.length;
  const ports = permissions.host_ports.length;
  if (entries.length === 0) return null;
  return (
    <span className="flex flex-wrap items-center gap-1" data-testid="permission-badges">
      {dangerous.map((entry) => (
        <StatusBadge key={entry.key} tone="destructive" title={entry.detail}>
          {entry.label}
        </StatusBadge>
      ))}
      {paths > 0 ? <Badge variant="outline">{plural(paths, 'host path')}</Badge> : null}
      {ports > 0 ? <Badge variant="outline">{plural(ports, 'host port')}</Badge> : null}
    </span>
  );
}
