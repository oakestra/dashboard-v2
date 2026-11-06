import type {
  CommandAction,
  CommandContext,
  CommandResult,
  CommandResultTone,
  IconProps,
} from '@oakestra/dashboard-sdk';
import type { ComponentType } from 'react';

import {
  sourceKey,
  type ContributionSource,
  type ResolvedContribution,
} from '../../../core/extensions/registry';
import type { NavEntry } from '../nav-model';
import type { ExternalLink } from '../use-nav';
import type { Matchable } from './match';

export type EntryTarget =
  | { kind: 'path'; path: string }
  | { kind: 'external'; href: string }
  | { kind: 'run'; run: (context: CommandContext) => void | Promise<void> };

/** One row of the palette, whatever it came from. */
export interface PaletteEntry extends Matchable {
  /** cmdk's identity of the row, unique in the palette. Labels would not be. */
  value: string;
  icon?: ComponentType<IconProps> | undefined;
  tone?: CommandResultTone | undefined;
  /** Absent for links from the runtime config, which nobody contributed. */
  source?: ContributionSource;
  target: EntryTarget;
}

/** Runtime-loaded addons say where they come from: the deployment did not ship that code. */
export const isRemote = (
  source: ContributionSource | undefined,
): source is Extract<ContributionSource, { kind: 'addon' }> =>
  source?.kind === 'addon' && source.remote === true;

function commandTarget(command: CommandAction | CommandResult): EntryTarget {
  return command.run ? { kind: 'run', run: command.run } : { kind: 'path', path: command.path };
}

/**
 * The sidebar as a flat list. A sub-item that leads where its parent does (an "Overview") would
 * only be listed twice.
 */
export function goToEntries(
  entries: readonly NavEntry[],
  links: readonly ExternalLink[],
): PaletteEntry[] {
  const pages = entries.flatMap(({ key, item, source, children }): PaletteEntry[] => [
    {
      value: `nav:${key}`,
      label: item.label,
      icon: item.icon,
      source,
      target: { kind: 'path', path: item.path },
    },
    ...children
      .filter((child) => child.item.path !== item.path)
      .map((child): PaletteEntry => ({
        value: `nav:${child.key}`,
        label: child.item.label,
        description: item.label,
        icon: item.icon,
        source,
        target: { kind: 'path', path: child.item.path },
      })),
  ]);
  const external = links.map((link): PaletteEntry => ({
    value: `external:${link.id}`,
    label: link.label,
    icon: link.icon,
    target: { kind: 'external', href: link.href },
  }));
  return [...pages, ...external];
}

export function actionEntries(
  actions: readonly ResolvedContribution<'command.actions'>[],
): PaletteEntry[] {
  return actions.map(({ item, source }) => ({
    value: `action:${sourceKey(source)}:${item.id}`,
    label: item.label,
    description: item.description,
    keywords: item.keywords,
    icon: item.icon,
    source,
    target: commandTarget(item),
  }));
}

export function resultEntries(
  results: readonly CommandResult[],
  source: ContributionSource,
  sourceId: string,
): PaletteEntry[] {
  return results.map((result) => ({
    value: `result:${sourceKey(source)}:${sourceId}:${result.id}`,
    label: result.label,
    description: result.description,
    icon: result.icon,
    tone: result.tone,
    source,
    target: commandTarget(result),
  }));
}
