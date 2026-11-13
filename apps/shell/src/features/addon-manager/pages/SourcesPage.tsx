import { ADDON_SOURCE_KINDS, type MarketplaceSource } from '@oakestra/api';
import {
  Badge,
  Button,
  ConfirmDialog,
  DropdownMenuItem,
  DropdownMenuSeparator,
  EmptyState,
  Item,
  ItemContent,
  ItemDescription,
  ItemTitle,
  QueryErrorAlert,
  RowMenu,
  formatDateTime,
  formatRelativeTime,
  plural,
} from '@oakestra/ui';
import { DataList, type DataListSortOption } from '@oakestra/ui/data-table';
import { useQuery } from '@tanstack/react-query';
import {
  BadgeCheckIcon,
  DatabaseIcon,
  GlobeIcon,
  HardDriveIcon,
  HistoryIcon,
  PlusIcon,
  RefreshCwIcon,
  StoreIcon,
  Trash2Icon,
  type LucideIcon,
} from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';

import { useAddonsAdminApi } from '../../../core/addons/addons-admin';
import { useDeleteSource, useSyncSource } from '../api/mutations';
import { marketplaceSourcesQuery } from '../api/queries';
import { AddTapDialog } from '../components/AddTapDialog';
import { RegisterAddonDialog } from '../components/RegisterAddonDialog';
import { SOURCE_KIND_LABELS, showsSourceKind } from '../components/SourceLabel';
import { StateButton } from '../components/StateButton';
import { marketplaceSourceLink } from '../paths';

// The marketplace's own order: official first, then taps by name, then local. ADDON_SOURCE_KINDS
// is declared in that order.
const SORT_OPTIONS: readonly DataListSortOption<MarketplaceSource>[] = [
  { id: 'kind', label: 'Kind', value: (s) => `${ADDON_SOURCE_KINDS.indexOf(s.kind)}:${s.name}` },
];

const searchValue = (source: MarketplaceSource) => [source.name, source.kind, source.url].join(' ');

const KIND_ICONS: Readonly<Record<MarketplaceSource['kind'], LucideIcon>> = {
  official: BadgeCheckIcon,
  tap: GlobeIcon,
  local: HardDriveIcon,
};

// Fixed columns, so counts and state buttons line up from row to row; below md the count moves
// under the URL (its cell is placed in the second column, second row).
const ROW_GRID =
  'grid w-full grid-cols-[auto_minmax(0,1fr)_10rem_auto] items-center gap-x-4 gap-y-1 md:grid-cols-[auto_minmax(0,1fr)_6rem_11rem_auto]';

function parseTime(value: string | undefined): Date | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

/** The sync state and the sync action in one control: a failure is retried where it shows. */
function SyncButton({
  source,
  syncing,
  onSync,
}: {
  source: MarketplaceSource;
  syncing: boolean;
  onSync: () => void;
}) {
  const synced = parseTime(source.last_synced_at);
  const action = {
    label: source.last_error ? 'Retry sync' : 'Sync now',
    icon: RefreshCwIcon,
    ariaLabel: `Sync ${source.name}`,
    onClick: onSync,
  };
  const serial = source.serial > 0 ? ` Serial ${source.serial}.` : '';
  if (syncing) return <StateButton tone="info" state="Syncing" pending />;
  if (source.last_error) {
    // Warning, not destructive: the marketplace keeps serving what it had, and the tab shows the
    // count of failing sources in the same tone.
    return (
      <StateButton
        tone="warning"
        state="Sync failed"
        action={action}
        data-testid={`source-sync-${source.name}`}
        hint={
          <>
            <span className="block font-medium">The last sync failed</span>
            {source.last_error.replace(/\.$/, '')}.{' '}
            {synced
              ? `The addons of the last good index (${formatRelativeTime(synced)}) stay listed.`
              : 'No index has been fetched from it yet.'}
          </>
        }
      />
    );
  }
  return (
    <StateButton
      tone="neutral"
      state={synced ? `Synced ${formatRelativeTime(synced)}` : 'Never synced'}
      stateIcon={synced ? HistoryIcon : RefreshCwIcon}
      action={action}
      hint={synced ? `Last synced ${formatDateTime(synced)}.${serial}` : undefined}
    />
  );
}

function SourceItem({
  source,
  syncing,
  onSync,
  onDelete,
  onRegister,
}: {
  source: MarketplaceSource;
  syncing: boolean;
  onSync: () => void;
  onDelete: () => void;
  onRegister: () => void;
}) {
  const KindIcon = KIND_ICONS[source.kind];
  const flags = [
    showsSourceKind(source) ? { label: SOURCE_KIND_LABELS[source.kind] } : null,
    source.has_token ? { label: 'Token', title: 'Fetched with a bearer token' } : null,
    // The official source is trusted with both by configuration, not by an admin.
    source.kind === 'tap' && source.allow_insecure ? { label: 'Plain http allowed' } : null,
    source.kind === 'tap' && source.allow_private ? { label: 'Private addresses allowed' } : null,
  ].filter((flag) => flag !== null);

  return (
    <Item data-testid={`source-${source.name}`}>
      <div className={ROW_GRID}>
        <span
          aria-hidden
          className="bg-background text-muted-foreground row-span-2 flex size-9 items-center justify-center self-start rounded-lg border md:row-span-1 md:self-center [&_svg]:size-4"
        >
          <KindIcon />
        </span>

        <ItemContent className="min-w-0 gap-0.5">
          <ItemTitle className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
            {source.name}
            {flags.map((flag) => (
              <Badge key={flag.label} variant="outline" title={flag.title} className="font-normal">
                {flag.label}
              </Badge>
            ))}
          </ItemTitle>
          {source.url ? (
            <ItemDescription
              className="line-clamp-1 font-mono text-xs break-all"
              title={source.url}
            >
              {source.url}
            </ItemDescription>
          ) : (
            <ItemDescription className="line-clamp-1">
              Definitions registered on this marketplace.
            </ItemDescription>
          )}
        </ItemContent>

        <Link
          to={marketplaceSourceLink(source.name)}
          aria-label={`Addons of ${source.name}`}
          className="text-muted-foreground hover:text-foreground col-start-2 row-start-2 text-sm tabular-nums underline-offset-4 hover:underline md:col-start-3 md:row-start-1 md:text-right"
        >
          {plural(source.addon_count, 'addon')}
        </Link>

        <div className="col-start-3 row-start-1 md:col-start-4">
          {source.sync_enabled ? (
            <SyncButton source={source} syncing={syncing} onSync={onSync} />
          ) : source.kind === 'local' ? (
            <Button variant="outline" size="sm" className="w-full" onClick={onRegister}>
              <PlusIcon aria-hidden data-icon="inline-start" />
              Register addon
            </Button>
          ) : null}
        </div>

        <div className="col-start-4 row-start-1 md:col-start-5">
          <RowMenu label={`More actions for ${source.name}`}>
            <DropdownMenuItem asChild>
              <Link to={marketplaceSourceLink(source.name)}>
                <StoreIcon aria-hidden />
                Show its addons
              </Link>
            </DropdownMenuItem>
            {source.deletable ? (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onSelect={onDelete}>
                  <Trash2Icon aria-hidden />
                  Delete tap
                </DropdownMenuItem>
              </>
            ) : null}
          </RowMenu>
        </div>
      </div>
    </Item>
  );
}

/** Where the catalog comes from: the official index, taps an admin added, local registrations. */
export function SourcesPage() {
  const api = useAddonsAdminApi();
  const sources = useQuery(marketplaceSourcesQuery(api));
  const sync = useSyncSource();
  const remove = useDeleteSource();
  const [addOpen, setAddOpen] = useState(false);
  const [deleting, setDeleting] = useState<MarketplaceSource | null>(null);
  const [registerOpen, setRegisterOpen] = useState(false);

  const addButton = (
    <Button onClick={() => setAddOpen(true)}>
      <PlusIcon aria-hidden data-icon="inline-start" />
      Add tap
    </Button>
  );

  return (
    <div className="space-y-6">
      {sources.isError ? (
        <>
          <div className="flex justify-end">{addButton}</div>
          <QueryErrorAlert
            data-testid="sources-error"
            title="Could not load the sources"
            error={sources.error}
            onRetry={() => void sources.refetch()}
          />
        </>
      ) : (
        <DataList
          label="Sources"
          noun="source"
          data={sources.data}
          isLoading={sources.isPending}
          getRowId={(source) => source.name}
          sortOptions={SORT_OPTIONS}
          searchValue={searchValue}
          searchPlaceholder="Search sources"
          toolbar={addButton}
          renderItem={(source) => (
            <SourceItem
              source={source}
              syncing={sync.isPending && sync.variables === source.name}
              onSync={() => sync.mutate(source.name)}
              onDelete={() => setDeleting(source)}
              onRegister={() => setRegisterOpen(true)}
            />
          )}
          emptyState={
            <EmptyState
              icon={<DatabaseIcon />}
              title="No sources"
              description="Add a tap to list third-party addons."
            />
          }
        />
      )}

      <AddTapDialog open={addOpen} onOpenChange={setAddOpen} />
      <RegisterAddonDialog open={registerOpen} onOpenChange={setRegisterOpen} />
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
        title={`Delete the tap ${deleting?.name ?? ''}?`}
        description={`This removes ${plural(deleting?.addon_count ?? 0, 'addon')} from the marketplace. Installed addons from it keep running, but can no longer be updated or approved again.`}
        confirmLabel="Delete tap"
        destructive
        pending={remove.isPending}
        onConfirm={() => {
          if (deleting) remove.mutate(deleting.name, { onSettled: () => setDeleting(null) });
        }}
      />
    </div>
  );
}
