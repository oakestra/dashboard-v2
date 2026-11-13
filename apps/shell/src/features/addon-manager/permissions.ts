import type { AddonPermissions } from '@oakestra/api';

export interface PermissionEntry {
  /** Stable key, e.g. `docker_socket` or `host_paths:/data`. */
  key: string;
  label: string;
  detail: string;
  /**
   * Root on the host or close to it on the control plane. The consent dialog makes the admin
   * tick these off explicitly, because accepting them is the only guard there is.
   */
  dangerous: boolean;
  /** Not covered by `previous` (an update that asks for more). */
  added: boolean;
}

const FLAGS = [
  {
    key: 'docker_socket',
    label: 'Docker socket',
    detail: 'Controls the container runtime. This is root on the host.',
  },
  {
    key: 'host_root',
    label: 'System host paths',
    detail: 'Mounts root-equivalent paths such as /etc, /proc, /sys or /var/lib/docker.',
  },
  {
    key: 'core_network',
    label: 'Core network',
    detail:
      'Joins the oakestra network, where Mongo, Redis and the core APIs are reachable without authentication.',
  },
  {
    key: 'host_network',
    label: 'Host network',
    detail: "Uses the host's network stack and can bind any port on it.",
  },
] as const;

/** `/data:ro` covers only read-only use, `/data` both. */
function covers(previous: readonly string[], entry: string): boolean {
  return previous.includes(entry) || previous.includes(entry.replace(/:ro$/, ''));
}

/**
 * The permissions as a list a person can read, dangerous ones first. With `previous` (what an
 * installed version was granted), entries the new set adds are marked like the backend's
 * `Grows`: a path counts as covered only when the same path was granted with at least that access.
 */
export function permissionEntries(
  permissions: AddonPermissions,
  previous?: AddonPermissions,
): PermissionEntry[] {
  const entries: PermissionEntry[] = [];
  for (const flag of FLAGS) {
    if (!permissions[flag.key]) continue;
    entries.push({
      ...flag,
      dangerous: true,
      added: previous !== undefined && !previous[flag.key],
    });
  }
  for (const entry of permissions.host_paths) {
    const readOnly = entry.endsWith(':ro');
    const path = readOnly ? entry.slice(0, -3) : entry;
    entries.push({
      key: `host_paths:${entry}`,
      label: path,
      detail: readOnly ? 'Host path, read-only' : 'Host path, read and write',
      dangerous: false,
      added: previous !== undefined && !covers(previous.host_paths, entry),
    });
  }
  for (const port of permissions.host_ports) {
    entries.push({
      key: `host_ports:${port}`,
      label: `Port ${port}`,
      detail: 'Published on the host',
      dangerous: false,
      added: previous !== undefined && !previous.host_ports.includes(port),
    });
  }
  return entries;
}

export function hasDangerousPermissions(permissions: AddonPermissions): boolean {
  return FLAGS.some((flag) => permissions[flag.key]);
}
