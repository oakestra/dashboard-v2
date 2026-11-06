import {
  AddonContext,
  describeError,
  useHostContext,
  type CurrentUser,
} from '@oakestra/dashboard-sdk';
import { SourceTag, StatusDot } from '@oakestra/ui';
import {
  CommandDialog,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@oakestra/ui/command';
import { useQueryClient } from '@tanstack/react-query';
import { ExternalLinkIcon } from 'lucide-react';
import { useMemo, useState } from 'react';
import { flushSync } from 'react-dom';
import { useNavigate } from 'react-router';

import { ErrorBoundary } from '../../../core/extensions/ErrorBoundary';
import { useContributions } from '../../../core/extensions/use-contributions';
import { useNav } from '../use-nav';
import { commandContextFor, type CommandHost } from './context';
import { actionEntries, goToEntries, isRemote, type PaletteEntry } from './entries';
import { filterAndRank } from './match';
import { useDebounced, useSourceSearch } from './use-source-search';

function EntryIcon({ entry }: { entry: PaletteEntry }) {
  const { icon: Icon, tone, source } = entry;
  // A result in an abnormal state shows that instead of its icon, it is what the user looks for.
  if (tone) {
    return (
      <span className="flex size-4 items-center justify-center">
        <StatusDot tone={tone} className="size-2.5" />
      </span>
    );
  }
  if (!Icon) {
    return (
      <span aria-hidden className="flex size-4 items-center justify-center">
        <span className="bg-muted-foreground h-0.5 w-2.5 rounded-full" />
      </span>
    );
  }
  return (
    // An addon icon that throws must not take the palette down with it, and it may read the addon
    // context like everything else an addon renders.
    <ErrorBoundary fallback={() => <span className="size-4" />}>
      <AddonContext.Provider value={source?.kind === 'addon' ? source.addon : null}>
        <Icon className="text-muted-foreground size-4 shrink-0" />
      </AddonContext.Provider>
    </ErrorBoundary>
  );
}

const ENTER_HINTS: Record<PaletteEntry['target']['kind'], string> = {
  path: 'Enter opens',
  external: 'Enter opens a new tab',
  run: 'Enter runs',
};

function EntryRow({
  entry,
  disabled,
  onSelect,
}: {
  entry: PaletteEntry;
  disabled?: boolean;
  onSelect: (entry: PaletteEntry) => void;
}) {
  const { source } = entry;
  return (
    <CommandItem
      // cmdk selects the first row when one mounts and nothing is selected, not when a row becomes
      // enabled, so a stale row that turns out to be current has to count as a new one.
      key={disabled ? 'stale' : 'current'}
      value={entry.value}
      disabled={disabled}
      onSelect={() => onSelect(entry)}
      className="group min-h-10 gap-2.5"
    >
      <EntryIcon entry={entry} />
      <span className="min-w-0 flex-1">
        <span className="block truncate">{entry.label}</span>
        {entry.description ? (
          <span className="text-muted-foreground block truncate text-xs">{entry.description}</span>
        ) : null}
      </span>
      {entry.target.kind === 'external' ? (
        <ExternalLinkIcon aria-hidden className="text-muted-foreground size-3" />
      ) : null}
      <span
        aria-hidden
        className="text-muted-foreground hidden shrink-0 text-xs md:group-data-[selected=true]:inline"
      >
        {ENTER_HINTS[entry.target.kind]}
      </span>
      {isRemote(source) ? (
        <SourceTag name={source.displayName ?? source.id} version={source.version} />
      ) : null}
    </CommandItem>
  );
}

function EntryGroup({
  heading,
  entries,
  disabled,
  onSelect,
}: {
  heading: string;
  entries: readonly PaletteEntry[];
  disabled?: boolean;
  onSelect: (entry: PaletteEntry) => void;
}) {
  if (entries.length === 0) return null;
  return (
    <CommandGroup heading={heading}>
      {entries.map((entry) => (
        <EntryRow key={entry.value} entry={entry} disabled={disabled} onSelect={onSelect} />
      ))}
    </CommandGroup>
  );
}

/**
 * The dialog itself. It only exists while open, so every open starts with an empty query and no
 * reset is needed.
 */
export function CommandPaletteDialog({
  user,
  onClose,
}: {
  user: CurrentUser;
  onClose: () => void;
}) {
  const hostContext = useHostContext();
  const queryClient = useQueryClient();
  const routerNavigate = useNavigate();
  const host: CommandHost = {
    host: hostContext,
    user,
    queryClient,
    navigate: (path) => void routerNavigate(path),
  };

  const [input, setInput] = useState('');
  const typed = input.trim();
  const settled = useDebounced(typed);

  const nav = useNav();
  const actions = useContributions('command.actions');
  const searches = useSourceSearch(useContributions('command.sources'), typed, settled, host);

  const goTo = useMemo(
    () => filterAndRank(goToEntries(nav.entries, nav.externalLinks), typed),
    [nav.entries, nav.externalLinks, typed],
  );
  const matchingActions = useMemo(
    () => filterAndRank(actionEntries(actions), typed),
    [actions, typed],
  );
  const localActions = matchingActions.filter((entry) => !isRemote(entry.source));
  const addonActions = matchingActions.filter((entry) => isRemote(entry.source));

  const select = async ({ target, source, label }: PaletteEntry) => {
    // Synchronously, for commands that open something themselves or ask a question right away.
    flushSync(onClose);
    if (target.kind === 'external') {
      window.open(target.href, '_blank', 'noopener,noreferrer');
      return;
    }
    if (!source) return;
    const context = commandContextFor(host, source);
    // Not covered by any error boundary: this runs in an event handler, and after the dialog closed.
    try {
      if (target.kind === 'run') await target.run(context);
      else context.navigate(target.path);
    } catch (error) {
      console.error(`[commands] "${label}" failed`, error);
      hostContext.notify.error(`${label} failed`, { description: describeError(error) });
    }
  };
  const onSelect = (entry: PaletteEntry) => void select(entry);

  const searching = searches.filter((search) => search.searching);
  const failed = searches.filter((search) => search.failed);
  const nothingFound =
    typed !== '' &&
    searching.length === 0 &&
    goTo.length === 0 &&
    matchingActions.length === 0 &&
    searches.every((search) => search.entries.length === 0);

  const goToGroup = <EntryGroup heading="Go to" entries={goTo} onSelect={onSelect} />;

  return (
    <CommandDialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title="Find or run anything"
      description="Search pages, actions and what the dashboard manages. Press Enter to open the selected entry."
      showCloseButton={false}
      className="top-4 max-h-[calc(100dvh-2rem)] translate-y-0 gap-0 sm:top-[12dvh] sm:max-w-2xl"
      commandProps={{
        label: 'Find or run anything',
        shouldFilter: false,
        // On by default, and it makes Ctrl+K "move up", the same key that closes the palette.
        vimBindings: false,
        loop: true,
        // CommandDialog's defaults are sized for one-line rows of a larger list.
        className: '[&_[cmdk-item]]:py-1.5 [&_[cmdk-item]_svg]:h-4 [&_[cmdk-item]_svg]:w-4',
      }}
    >
      <CommandInput
        placeholder="Find or run anything"
        value={input}
        onValueChange={setInput}
        className="h-12 text-base"
      />
      <CommandList className="max-h-[min(26rem,calc(100dvh-10rem))]">
        {/* Typing usually means going somewhere. An empty palette leads with what can be run, the
            sidebar already lists the pages and would push every action below the fold. */}
        {typed ? goToGroup : null}
        <EntryGroup heading="Actions" entries={localActions} onSelect={onSelect} />
        <EntryGroup heading="From addons" entries={addonActions} onSelect={onSelect} />
        {typed ? null : goToGroup}
        {/* Below everything that is known at once, so results arriving never move the selection. */}
        {searches.map((search) => (
          <EntryGroup
            key={search.key}
            heading={search.label}
            entries={search.entries}
            disabled={search.stale}
            onSelect={onSelect}
          />
        ))}
      </CommandList>
      {/* Not inside the list: a listbox may only hold options. */}
      <div role="status" className="text-muted-foreground text-sm empty:hidden">
        {nothingFound ? <p className="px-4 py-6 text-center">Nothing found for "{typed}"</p> : null}
        {searching.length > 0 ? <p className="border-t px-4 py-1.5 text-xs">Searching...</p> : null}
        {failed.map((search) => (
          <p key={search.key} className="border-t px-4 py-1.5 text-xs">
            {search.label} could not be searched
          </p>
        ))}
      </div>
      <div className="text-muted-foreground hidden gap-4 border-t px-4 py-2 text-xs sm:flex">
        <span>Up and down to move</span>
        <span>Enter to open</span>
        <span>Esc to close</span>
      </div>
    </CommandDialog>
  );
}
