import { ADDON_SOURCE_KINDS, type MarketplaceSource } from '@oakestra/api';
import {
  Alert,
  AlertDescription,
  Badge,
  Button,
  ConfirmDialog,
  EmptyState,
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemTitle,
  QueryErrorAlert,
  formatDateTime,
  formatRelativeTime,
  plural,
} from '@oakestra/ui';
import { DataList, type DataListSortOption } from '@oakestra/ui/data-table';
import { useQuery } from '@tanstack/react-query';
import { DatabaseIcon, PlusIcon, RefreshCwIcon, Trash2Icon } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';

import { useAddonsAdminApi } from '../../../core/addons/addons-admin';
import { useDeleteSource, useSyncSource } from '../api/mutations';
import { marketplaceSourcesQuery } from '../api/queries';
import { AddTapDialog } from '../components/AddTapDialog';
import { marketplaceSourceLink } from '../paths';

const KIND_LABELS: Readonly<Record<MarketplaceSource['kind'], string>> = {
  official: 'Official',
  tap: 'Tap',
  local: 'Local',
};

// The marketplace's own order: official first, then taps by name, then local. ADDON_SOURCE_KINDS
// is declared in that order.
const SORT_OPTIONS: readonly DataListSortOption<MarketplaceSource>[] = [
  { id: 'kind', label: 'Kind', value: (s) => `${ADDON_SOURCE_KINDS.indexOf(s.kind)}:${s.name}` },
];

const searchValue = (source: MarketplaceSource) => [source.name, source.kind, source.url].join(' ');

function timeText(value: string | undefined): { text: string; title?: string } {
  if (!value) return { text: 'never' };
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? { text: value }
    : { text: formatRelativeTime(date), title: formatDateTime(date) };
}

function SourceItem({
  source,
  syncing,
  onSync,
  onDelete,
}: {
  source: MarketplaceSource;
  syncing: boolean;
  onSync: () => void;
  onDelete: () => void;
}) {
  const synced = timeText(source.last_synced_at);
  return (
    <Item data-testid={`source-${source.name}`} className="items-start">
      <ItemContent className="basis-72">
        <ItemTitle className="flex flex-wrap items-center gap-2">
          <Link
            to={marketplaceSourceLink(source.name)}
            className="underline-offset-4 hover:underline"
            aria-label={`Addons of ${source.name}`}
          >
            {source.name}
          </Link>
          <Badge variant="outline">{KIND_LABELS[source.kind]}</Badge>
          {source.has_token ? <Badge variant="secondary">Token</Badge> : null}
          {/* The official source is trusted with both by configuration, not by an admin. */}
          {source.kind === 'tap' && source.allow_insecure ? (
            <Badge variant="secondary">http allowed</Badge>
          ) : null}
          {source.kind === 'tap' && source.allow_private ? (
            <Badge variant="secondary">Private addresses allowed</Badge>
          ) : null}
        </ItemTitle>
        {source.url ? (
          <ItemDescription className="font-mono text-xs break-all">{source.url}</ItemDescription>
        ) : (
          <ItemDescription>Definitions registered on this marketplace.</ItemDescription>
        )}
        {source.last_error ? (
          <Alert variant="destructive" className="mt-2" data-testid={`source-error-${source.name}`}>
            <AlertDescription className="break-words">
              {source.last_error}. The last good index stays listed.
            </AlertDescription>
          </Alert>
        ) : null}
      </ItemContent>
      <dl className="grid grid-cols-[auto_auto] gap-x-3 gap-y-0.5 text-sm">
        <dt className="text-muted-foreground">Addons</dt>
        <dd className="tabular-nums">{source.addon_count}</dd>
        {source.kind === 'local' ? null : (
          <>
            <dt className="text-muted-foreground">Synced</dt>
            <dd title={synced.title}>{synced.text}</dd>
            {source.serial > 0 ? (
              <>
                <dt className="text-muted-foreground">Serial</dt>
                <dd className="tabular-nums">{source.serial}</dd>
              </>
            ) : null}
          </>
        )}
      </dl>
      <ItemActions className="ml-auto">
        {source.sync_enabled ? (
          <Button
            variant="outline"
            size="sm"
            aria-label={`Sync ${source.name}`}
            disabled={syncing}
            onClick={onSync}
          >
            <RefreshCwIcon className={syncing ? 'animate-spin' : undefined} aria-hidden />
            Sync
          </Button>
        ) : null}
        {source.deletable ? (
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive"
            aria-label={`Delete ${source.name}`}
            onClick={onDelete}
          >
            <Trash2Icon aria-hidden />
            Delete
          </Button>
        ) : null}
      </ItemActions>
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

  const addButton = (
    <Button onClick={() => setAddOpen(true)}>
      <PlusIcon aria-hidden />
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
