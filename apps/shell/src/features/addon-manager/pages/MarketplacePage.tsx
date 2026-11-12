import { useSearchParam } from '@oakestra/dashboard-sdk';
import { ADDON_SOURCE_KINDS, type InstalledAddon, type MarketplaceAddon } from '@oakestra/api';
import {
  Button,
  ConfirmDialog,
  EmptyState,
  QueryErrorAlert,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@oakestra/ui';
import { DataList, type DataListSortOption } from '@oakestra/ui/data-table';
import { useQuery } from '@tanstack/react-query';
import { PlusIcon, SearchXIcon, StoreIcon } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';

import { useAddonsAdminApi } from '../../../core/addons/addons-admin';
import { useDeleteLocalAddon, useInstallAddon } from '../api/mutations';
import { installedAddonsQuery, marketplaceAddonsQuery } from '../api/queries';
import { MarketplaceCard } from '../components/MarketplaceCard';
import { MarketplaceDetailsDialog } from '../components/MarketplaceDetailsDialog';
import { ConsentDialog } from '../components/ConsentDialog';
import { useConsentReview } from '../components/use-consent-review';
import { RegisterAddonDialog } from '../components/RegisterAddonDialog';
import { INSTALLED_PATH } from '../paths';

const searchValue = (addon: MarketplaceAddon) =>
  [
    addon.qualified_name,
    addon.description,
    addon.source.name,
    ...addon.services.map((service) => service.image),
  ].join(' ');

// The marketplace's own order: official first, then taps by name, then local registrations.
// ADDON_SOURCE_KINDS is declared in that order.

const SORT_OPTIONS: readonly DataListSortOption<MarketplaceAddon>[] = [
  {
    id: 'source',
    label: 'Source',
    value: (addon) =>
      `${ADDON_SOURCE_KINDS.indexOf(addon.source.kind)}:${addon.source.name}:${addon.name}`,
  },
  { id: 'name', label: 'Name', value: (addon) => addon.name },
];

const ALL_SOURCES = 'all';

/**
 * The record an addon's card shows: a live one when there is one,
 * otherwise a disabled one, whose card still offers Install (see MarketplaceCard).
 */
function installedByAddonId(installed: readonly InstalledAddon[]): Map<string, InstalledAddon> {
  const byId = new Map<string, InstalledAddon>();
  for (const addon of installed) {
    const known = byId.get(addon.addon_id);
    if (!known || known.status === 'disabled') byId.set(addon.addon_id, addon);
  }
  return byId;
}

export function MarketplacePage() {
  const api = useAddonsAdminApi();
  const marketplace = useQuery(marketplaceAddonsQuery(api));
  const installed = useQuery(installedAddonsQuery(api));
  const navigate = useNavigate();

  const [search, setSearch] = useSearchParam('q');
  const [sourceFilter, setSourceFilter] = useSearchParam('source');
  const [details, setDetails] = useState<MarketplaceAddon | null>(null);
  const [deleting, setDeleting] = useState<MarketplaceAddon | null>(null);
  const consent = useConsentReview<MarketplaceAddon>();
  const [registerOpen, setRegisterOpen] = useState(false);
  const install = useInstallAddon();
  const deleteLocal = useDeleteLocalAddon();

  const installedById = useMemo(() => installedByAddonId(installed.data ?? []), [installed.data]);
  const deletingInstalled = deleting ? installedById.get(deleting.id) : undefined;

  const sources = useMemo(() => {
    const names = new Map<string, number>();
    for (const addon of marketplace.data ?? []) {
      names.set(addon.source.name, (names.get(addon.source.name) ?? 0) + 1);
    }
    return [...names];
  }, [marketplace.data]);
  const visible = useMemo(
    () =>
      sourceFilter
        ? marketplace.data?.filter((addon) => addon.source.name === sourceFilter)
        : marketplace.data,
    [marketplace.data, sourceFilter],
  );

  /**
   * The catalog serves no hash on purpose, so the first call goes without one and the 409 brings
   * the definition as the addons-manager would store it, which is what the dialog shows. If the
   * catalog changes before the admin confirms, the retry gets another 409 with the new definition
   * and the dialog comes back with it.
   */
  function runInstall(item: MarketplaceAddon, acceptDefinition?: string) {
    install.mutate(
      { qualifiedName: item.qualified_name, acceptDefinition },
      {
        onSuccess: (outcome) => {
          consent.show(item, outcome, (request) => ({
            title: `Install ${item.qualified_name} ${request.definition.version}?`,
            description:
              'Review what this addon runs and may do on the host. Installing accepts exactly this definition.',
            confirmLabel: 'Accept and install',
          }));
          // The installed tab shows the progress of the new addon.
          if (outcome.kind === 'done') void navigate(INSTALLED_PATH);
        },
        onError: consent.clear,
      },
    );
  }

  const canInstall = installed.isSuccess && !install.isPending;

  const registerButton = (
    <Button onClick={() => setRegisterOpen(true)}>
      <PlusIcon aria-hidden />
      Register addon
    </Button>
  );

  const toolbar = (
    <div className="flex flex-wrap items-center gap-2">
      <Select
        value={sourceFilter || ALL_SOURCES}
        onValueChange={(value) => setSourceFilter(value === ALL_SOURCES ? '' : value)}
      >
        <SelectTrigger aria-label="Source" className="w-44">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL_SOURCES}>All sources</SelectItem>
          {sources.map(([name, count]) => (
            <SelectItem key={name} value={name}>
              {name} ({count})
            </SelectItem>
          ))}
          {sourceFilter && !sources.some(([name]) => name === sourceFilter) ? (
            <SelectItem value={sourceFilter}>{sourceFilter} (0)</SelectItem>
          ) : null}
        </SelectContent>
      </Select>
      {registerButton}
    </div>
  );

  return (
    <div className="space-y-6">
      {installed.isError && marketplace.isSuccess ? (
        <QueryErrorAlert
          data-testid="installed-unknown"
          title="Installed addons are unknown"
          error={installed.error}
          onRetry={() => void installed.refetch()}
        >
          {' Installing is paused until they load.'}
        </QueryErrorAlert>
      ) : null}

      {marketplace.isError ? (
        <>
          {/* Registering does not depend on the list, so it survives the list's failure. */}
          <div className="flex justify-end">{registerButton}</div>
          <QueryErrorAlert
            data-testid="marketplace-error"
            title="Could not load the marketplace"
            error={marketplace.error}
            onRetry={() => void marketplace.refetch()}
          />
        </>
      ) : (
        <DataList
          label="Marketplace"
          noun="addon"
          layout="grid"
          data={visible}
          isLoading={marketplace.isPending}
          getRowId={(addon) => addon.qualified_name}
          searchValue={searchValue}
          sortOptions={SORT_OPTIONS}
          searchPlaceholder="Search the marketplace"
          globalFilter={search}
          onGlobalFilterChange={setSearch}
          toolbar={toolbar}
          renderItem={(addon) => (
            <MarketplaceCard
              addon={addon}
              installed={installedById.get(addon.id)}
              installing={
                install.isPending && install.variables?.qualifiedName === addon.qualified_name
              }
              canInstall={canInstall}
              onInstall={() => runInstall(addon)}
              onDetails={() => setDetails(addon)}
              onDelete={addon.source.kind === 'local' ? () => setDeleting(addon) : undefined}
            />
          )}
          emptyState={
            sourceFilter ? (
              <EmptyState
                icon={<StoreIcon />}
                title={`No addons from ${sourceFilter}`}
                description="The source lists no addons, or its index could not be fetched yet."
                action={
                  <Button variant="outline" size="sm" onClick={() => setSourceFilter('')}>
                    Show all sources
                  </Button>
                }
              />
            ) : (
              <EmptyState
                icon={<StoreIcon />}
                title="The marketplace is empty"
                description="Add a source or register an addon definition to make it available here."
              />
            )
          }
          noResultsState={
            <EmptyState
              icon={<SearchXIcon />}
              title="No addons match your search"
              description="Try another name, source or image."
              action={
                <Button variant="outline" size="sm" onClick={() => setSearch('')}>
                  Clear search
                </Button>
              }
            />
          }
        />
      )}

      <MarketplaceDetailsDialog
        addon={details}
        onClose={() => setDetails(null)}
        installed={details ? installedById.get(details.id) : undefined}
        canInstall={canInstall}
        onInstall={(item) => runInstall(item)}
      />
      <ConsentDialog
        review={consent.review}
        pending={install.isPending}
        onCancel={consent.clear}
        onConfirm={(hash) => {
          if (consent.review) runInstall(consent.review.target, hash);
        }}
      />
      <RegisterAddonDialog open={registerOpen} onOpenChange={setRegisterOpen} />
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
        title={`Delete ${deleting?.qualified_name ?? 'definition'} from the marketplace?`}
        description={
          deletingInstalled
            ? `${deleting?.qualified_name} is installed. It keeps running, but it can neither be updated nor approved again until it is registered anew.`
            : 'The local registration is removed and can no longer be installed.'
        }
        confirmLabel="Delete definition"
        destructive
        pending={deleteLocal.isPending}
        onConfirm={() => {
          if (deleting) {
            deleteLocal.mutate(
              { name: deleting.name, qualifiedName: deleting.qualified_name },
              { onSettled: () => setDeleting(null) },
            );
          }
        }}
      />
    </div>
  );
}
