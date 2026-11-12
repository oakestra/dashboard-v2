/**
 * Creates an addon UI from the template in `../template`. See USAGE, or `docs/addons/README.md`.
 */
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

import { parseCliArgs, resolveOptions, UsageError, USAGE } from './options.ts';
import { scaffold } from './scaffold.ts';
import { readWorkspaceState, repoRoot } from './workspace.ts';

function main(): void {
  const raw = parseCliArgs(process.argv.slice(2));
  if (raw.help) {
    console.log(USAGE);
    return;
  }
  // pnpm passes the caller's directory on; relative --dir values are relative to it.
  const cwd = process.env.INIT_CWD ?? process.cwd();
  const options = resolveOptions(raw, readWorkspaceState(), (dir) => resolve(cwd, dir));
  const { dir, files } = scaffold(options);

  console.log(`Created ${dir}`);
  for (const file of files) console.log(`  ${file}`);

  const standalone = options.dir !== undefined;
  if (!standalone && options.install) {
    // Links the new workspace package and adds it to pnpm-lock.yaml, which the Docker build
    // needs (--frozen-lockfile).
    console.log('\n$ pnpm install');
    execFileSync('pnpm', ['install'], { cwd: repoRoot, stdio: 'inherit' });
  }
  console.log(nextSteps(options.name, options.port, dir, standalone, options.install));
}

function nextSteps(
  name: string,
  port: number,
  dir: string,
  standalone: boolean,
  installed: boolean,
): string {
  const override = `http://localhost:5173/?addon-override=${name}=http://localhost:${port}/mf-manifest.json`;
  const lines = ['', 'Next steps:'];
  if (standalone) {
    lines.push(`  cd ${dir}`, '  pnpm install   # needs @oakestra/* from npm, see README.md');
  } else if (!installed) {
    lines.push('  pnpm install   # links the new package and updates pnpm-lock.yaml');
  }
  const run = (script: string) =>
    standalone ? `pnpm ${script}` : `pnpm --filter @oakestra/addon-${name} ${script}`;
  lines.push(
    `  ${run('dev')}   # dev server on port ${port}`,
    '  pnpm dev:mock   # in the repository: the shell, in a second terminal',
    `  open ${override}`,
    `  ${run('test')} && ${run('typecheck')} && ${run('build')}`,
    standalone
      ? `  docker build -t addon-${name}-ui .`
      : `  docker build -f addons/${name}/Dockerfile -t addon-${name}-ui .   # from the repository root`,
    '',
    'To install it in a dashboard: push the image, set it in marketplace-definition.json and',
    'publish the definition in an index (the official one or a tap). The addons engine runs the',
    `UI as addonui-${name}. A local registration is installed as local--${name}, which the`,
    `UI built as ${name} does not match.`,
  );
  return lines.join('\n');
}

try {
  main();
} catch (error) {
  if (error instanceof UsageError) {
    console.error(`Error: ${error.message}\n\n${USAGE}`);
  } else {
    console.error(`Error: ${(error as Error).message}`);
  }
  process.exitCode = 1;
}
