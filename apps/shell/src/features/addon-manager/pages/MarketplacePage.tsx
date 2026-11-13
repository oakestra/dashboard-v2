import { useSearchParam } from '@oakestra/dashboard-sdk';
import { ADDON_SOURCE_KINDS, type InstalledAddon, type MarketplaceAddon } from '@oakestra/api';
import {
  Button,
  CollectionSearch,
  ConfirmDialog,
  EmptyState,
  QueryErrorAlert,
  useSearchText,
} from '@oakestra/ui';
import { DataList, type DataListSortOption } from '@oakestra/ui/data-table';
import { useQuery } from '@tanstack/react-query';
import { FilterXIcon, PlusIcon, SearchXIcon, StoreIcon } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';

import { useAddonsAdminApi } from '../../../core/addons/addons-admin';
import { useDeleteLocalAddon, useInstallAddon } from '../api/mutations';
import { installedAddonsQuery, marketplaceAddonsQuery } from '../api/queries';
import { MarketplaceCard } from '../components/MarketplaceCard';
import { MarketplaceDetailsDialog } from '../components/MarketplaceDetailsDialog';
import { ActiveFilterChips, MarketplaceFilterMenu } from '../components/MarketplaceFilterMenu';
import { ConsentDialog } from '../components/ConsentDialog';
import { useConsentReview } from '../components/use-consent-review';
import { RegisterAddonDialog } from '../components/RegisterAddonDialog';
import { addonTitle } from '../display';
import {
  NO_FILTERS,
  activeFilterCount,
  facetCounts,
  filterMarketplace,
  marketplaceSearchValue,
  normalizeTag,
  readFilters,
  writeFilters,
  type MarketplaceFilters,
} from '../marketplace-filters';
import { INSTALLED_PATH } from '../paths';

// The marketplace's own order: official first, then taps by name, then local registrations.
// ADDON_SOURCE_KINDS is declared in that order. One option only, so DataList shows no sort picker:
// next to the source filter it looked like a second filter.
const SORT_OPTIONS: readonly DataListSortOption<MarketplaceAddon>[] = [
  {
    id: 'source',
    label: 'Source',
    value: (addon) =>
      `${ADDON_SOURCE_KINDS.indexOf(addon.source.kind)}:${addon.source.name}:${addon.name}`,
  },
];

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
  const [searchParams, setSearchParams] = useSearchParams();
  const [details, setDetails] = useState<MarketplaceAddon | null>(null);
  const [deleting, setDeleting] = useState<MarketplaceAddon | null>(null);
  const consent = useConsentReview<MarketplaceAddon>();
  const [registerOpen, setRegisterOpen] = useState(false);
  const install = useInstallAddon();
  const deleteLocal = useDeleteLocalAddon();

  const installedById = useMemo(() => installedByAddonId(installed.data ?? []), [installed.data]);
  const deletingInstalled = deleting ? installedById.get(deleting.id) : undefined;

  // Lists live in repeated parameters (`?category=ai&category=monitoring`), which the
  // single-value useSearchParam cannot hold.
  // Keyed on the filter parameters alone: the search text is in the URL too, and every keystroke
  // would otherwise refilter, recount and hand DataList a new array to rebuild its rows from.
  const filterKey = writeFilters(new URLSearchParams(), readFilters(searchParams)).toString();
  const filters = useMemo(() => readFilters(new URLSearchParams(filterKey)), [filterKey]);
  // One navigation for every change: react-router hands every setter of the same render the same
  // old params, so separate setters in a row would each undo the others.
  const setFilters = (next: MarketplaceFilters) =>
    setSearchParams((previous) => writeFilters(previous, next), { replace: true });
  const clearFilters = () => setFilters(NO_FILTERS);
  const filtered = activeFilterCount(filters) > 0;
  // Filters beyond the source: with only sources set, an empty list says the sources are empty.
  const narrowed = activeFilterCount({ ...filters, sources: [] }) > 0;
  const visible = useMemo(
    () => marketplace.data && filterMarketplace(marketplace.data, filters),
    [marketplace.data, filters],
  );
  // Counted from the loaded catalog rather than GET /categories, so the counts always match the
  // cards and changing a filter costs no request.
  const counts = useMemo(
    () => facetCounts(marketplace.data ?? [], filters),
    [marketplace.data, filters],
  );
  const toggleIn = (list: readonly string[], value: string) =>
    list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
  const [searchText, setSearchText] = useSearchText(search, setSearch);

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
            title: `Install ${addonTitle({ ...item, display_name: request.definition.display_name })} ${request.definition.version}?`,
            qualifiedName: item.qualified_name,
            description:
              'Review what this addon runs and may do on the host. Installing accepts exactly this definition.',
            confirmLabel: 'Accept and install',
            versionInTitle: true,
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

  // DataList's own search is hidden so the Filter button can sit next to the search box.
  const toolbar = (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <CollectionSearch
          label="Marketplace"
          placeholder="Search the marketplace"
          value={searchText}
          onChange={setSearchText}
        />
        <MarketplaceFilterMenu
          counts={counts}
          filters={filters}
          resultCount={visible?.length ?? 0}
          onChange={setFilters}
          onClear={clearFilters}
        />
        <div className="ml-auto">{registerButton}</div>
      </div>
      <ActiveFilterChips filters={filters} onChange={setFilters} onClear={clearFilters} />
    </div>
  );

  const clearFiltersButton = (
    <Button variant="outline" size="sm" onClick={clearFilters}>
      <FilterXIcon aria-hidden />
      Clear filters
    </Button>
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
        <>
          {toolbar}
          <DataList
            label="Marketplace"
            noun="addon"
            layout="grid"
            data={visible}
            isLoading={marketplace.isPending}
            getRowId={(addon) => addon.qualified_name}
            searchValue={marketplaceSearchValue}
            sortOptions={SORT_OPTIONS}
            hideSearch
            globalFilter={search}
            onGlobalFilterChange={setSearch}
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
                activeCategories={filters.categories}
                activeTags={filters.tags}
                onCategory={(category) =>
                  setFilters({ ...filters, categories: toggleIn(filters.categories, category) })
                }
                onTag={(tag) =>
                  setFilters({ ...filters, tags: toggleIn(filters.tags, normalizeTag(tag)) })
                }
              />
            )}
            emptyState={
              narrowed ? (
                <EmptyState
                  icon={<FilterXIcon />}
                  title="No addons match these filters"
                  description="No addon matches all of them. Remove one or clear them all."
                  action={clearFiltersButton}
                />
              ) : filters.sources.length > 0 ? (
                <EmptyState
                  icon={<StoreIcon />}
                  title={`No addons from ${filters.sources.join(' or ')}`}
                  description={
                    filters.sources.length === 1
                      ? 'The source lists no addons, or its index could not be fetched yet.'
                      : 'The sources list no addons, or their indexes could not be fetched yet.'
                  }
                  action={
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setFilters({ ...filters, sources: [] })}
                    >
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
                description="Try another name, tag, source or image."
                action={
                  <div className="flex flex-wrap justify-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => setSearch('')}>
                      Clear search
                    </Button>
                    {filtered ? clearFiltersButton : null}
                  </div>
                }
              />
            }
          />
        </>
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
