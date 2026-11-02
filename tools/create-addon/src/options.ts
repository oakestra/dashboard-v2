import { parseArgs } from 'node:util';

/** What the addons already in the workspace use, so a new one cannot collide with them. */
export interface WorkspaceState {
  addonNames: readonly string[];
  prefixes: readonly string[];
  ports: readonly number[];
}

export interface AddonOptions {
  name: string;
  prefix: string;
  label: string;
  port: number;
  /** Absolute target directory of a standalone addon, `undefined` for `addons/<name>`. */
  dir: string | undefined;
  install: boolean;
}

export class UsageError extends Error {}

export const USAGE = `Usage: pnpm create:addon <name> [--prefix <letters>] [--label <text>] [--port <n>]
                          [--dir <path>] [--no-install]

  name       addon name, lowercase letters, digits and "-" (the name in /ui-addons)
  --prefix   Tailwind class prefix, letters a-z only (default: the letters of the name)
  --label    display name in the sidebar and breadcrumbs (default: the name in title case)
  --port     dev server port (default: the next free one after the other addons)
  --dir      create a standalone addon in this directory, outside the repository, with
             @oakestra/* dependencies from npm instead of the workspace
  --no-install  do not run pnpm install after creating a workspace addon`;

// The same rules as oakestraAddon() in @oakestra/dashboard-sdk/vite, which fails the build on a
// mismatch. Checking here means the error shows up before anything is written.
const NAME = /^[a-z0-9-]+$/;
const PREFIX = /^[a-z]+$/;
// The label ends up unescaped in TSX text, string literals, HTML and JSON.
const UNSAFE_LABEL = /[<>{}"'`$\\&\p{Cc}]/u;

/** Port of the shell's own dev server; addon ports start above it. */
export const SHELL_PORT = 5173;

export function titleCase(name: string): string {
  return name
    .split('-')
    .filter(Boolean)
    .map((word) => word[0]!.toUpperCase() + word.slice(1))
    .join(' ');
}

export function defaultPrefix(name: string): string {
  return name.replace(/[^a-z]/g, '');
}

export function nextFreePort(used: readonly number[]): number {
  return Math.max(SHELL_PORT, ...used) + 1;
}

export interface RawArgs {
  name: string | undefined;
  prefix?: string;
  label?: string;
  port?: string;
  dir?: string;
  install: boolean;
  help: boolean;
}

export function parseCliArgs(argv: string[]): RawArgs {
  let parsed;
  try {
    parsed = parseArgs({
      args: argv,
      allowPositionals: true,
      options: {
        prefix: { type: 'string' },
        label: { type: 'string' },
        port: { type: 'string' },
        dir: { type: 'string' },
        'no-install': { type: 'boolean' },
        help: { type: 'boolean', short: 'h' },
      },
    });
  } catch (error) {
    throw new UsageError((error as Error).message);
  }
  const { values, positionals } = parsed;
  if (positionals.length > 1) {
    throw new UsageError(`Expected one addon name, got: ${positionals.join(' ')}`);
  }
  return {
    name: positionals[0],
    prefix: values.prefix,
    label: values.label,
    port: values.port,
    dir: values.dir,
    install: !values['no-install'],
    help: values.help ?? false,
  };
}

/**
 * Applies the defaults and checks everything that can be known without touching the target.
 * `resolveDir` turns `--dir` into an absolute path; the caller checks that it is usable.
 */
export function resolveOptions(
  raw: RawArgs,
  state: WorkspaceState,
  resolveDir: (dir: string) => string,
): AddonOptions {
  const { name } = raw;
  if (!name) throw new UsageError('Missing addon name.');
  if (!NAME.test(name)) {
    throw new UsageError(
      `Invalid addon name "${name}". Use lowercase letters, digits and "-" (^[a-z0-9-]+$): it ` +
        `is the name in /ui-addons and the container name addonui-<name>.`,
    );
  }
  const standalone = raw.dir !== undefined;
  if (!standalone && state.addonNames.includes(name)) {
    throw new UsageError(`addons/${name} already exists. Nothing was changed.`);
  }

  const prefix = raw.prefix ?? defaultPrefix(name);
  if (!prefix) {
    throw new UsageError(`"${name}" has no letters to derive a class prefix from; pass --prefix.`);
  }
  if (!PREFIX.test(prefix)) {
    throw new UsageError(
      `Invalid prefix "${prefix}". Tailwind prefixes are lowercase letters a-z only.`,
    );
  }
  // Two addons with one prefix generate the same class names and can override each other. A
  // standalone addon is checked against the workspace too: it may run in the same dashboard.
  if (state.prefixes.includes(prefix)) {
    throw new UsageError(
      `The prefix "${prefix}" is already used by another addon in addons/. Pick another with --prefix.`,
    );
  }

  const label = (raw.label ?? titleCase(name)).trim();
  if (!label) throw new UsageError('The label is empty; pass --label <text>.');
  if (label.length > 40) throw new UsageError('The label is longer than 40 characters.');
  if (UNSAFE_LABEL.test(label)) {
    throw new UsageError(
      `The label "${label}" contains a character that is not allowed (< > { } & " ' \` $ \\ or a control character).`,
    );
  }

  let port: number;
  if (raw.port === undefined) {
    port = nextFreePort(state.ports);
  } else {
    port = Number(raw.port);
    if (!/^\d+$/.test(raw.port) || port < 1024 || port > 65535) {
      throw new UsageError(`Invalid port "${raw.port}". Use a number from 1024 to 65535.`);
    }
    if (port === SHELL_PORT) {
      throw new UsageError(`Port ${SHELL_PORT} belongs to the shell's dev server.`);
    }
    if (state.ports.includes(port)) {
      throw new UsageError(`Port ${port} is already used by another addon. Pick another.`);
    }
  }

  return {
    name,
    prefix,
    label,
    port,
    dir: standalone ? resolveDir(raw.dir!) : undefined,
    install: raw.install,
  };
}
