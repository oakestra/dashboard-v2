import { useSearchParam } from '@oakestra/dashboard-sdk';
import type { MarketplaceAddon } from '@oakestra/api';
import { Button, ConfirmDialog, EmptyState, QueryErrorAlert } from '@oakestra/ui';
import { DataList, type DataListSortOption } from '@oakestra/ui/data-table';
import { useQuery } from '@tanstack/react-query';
import { PlusIcon, SearchXIcon, StoreIcon } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';

import { useAddonsAdminApi } from '../../../core/addons/addons-admin';
import { useDeleteDefinition, useInstallAddon } from '../api/mutations';
import { installedAddonsQuery, marketplaceAddonsQuery } from '../api/queries';
import { MarketplaceCard } from '../components/MarketplaceCard';
import { MarketplaceDetailsDialog } from '../components/MarketplaceDetailsDialog';
import { RegisterAddonDialog } from '../components/RegisterAddonDialog';
import { INSTALLED_PATH } from '../paths';

const searchValue = (addon: MarketplaceAddon) =>
  [addon.name, addon.description, ...addon.services.map((service) => service.image)].join(' ');

// One option: no picker, just a stable order.
const SORT_OPTIONS: readonly DataListSortOption<MarketplaceAddon>[] = [
  { id: 'name', label: 'Name', value: (addon) => addon.name },
];

export function MarketplacePage() {
  const api = useAddonsAdminApi();
  const marketplace = useQuery(marketplaceAddonsQuery(api));
  const installed = useQuery(installedAddonsQuery(api));
  const navigate = useNavigate();

  const [search, setSearch] = useSearchParam('q');
  const [details, setDetails] = useState<MarketplaceAddon | null>(null);
  const [deleting, setDeleting] = useState<MarketplaceAddon | null>(null);
  const [registerOpen, setRegisterOpen] = useState(false);
  const install = useInstallAddon();
  const deleteDefinition = useDeleteDefinition();

  const installedByDefinition = useMemo(
    () => new Map((installed.data ?? []).map((addon) => [addon.marketplace_id, addon])),
    [installed.data],
  );
  const deletingInstalled = deleting ? installedByDefinition.get(deleting._id) : undefined;

  function startInstall(addon: MarketplaceAddon) {
    install.mutate(
      { marketplaceId: addon._id, name: addon.name },
      // The installed tab shows the progress of the new addon.
      { onSuccess: () => void navigate(INSTALLED_PATH) },
    );
  }

  const registerButton = (
    <Button onClick={() => setRegisterOpen(true)}>
      <PlusIcon aria-hidden />
      Register addon
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
        <DataList
          label="Marketplace"
          noun="addon"
          layout="grid"
          data={marketplace.data}
          isLoading={marketplace.isPending}
          getRowId={(addon) => addon._id}
          searchValue={searchValue}
          sortOptions={SORT_OPTIONS}
          searchPlaceholder="Search the marketplace"
          globalFilter={search}
          onGlobalFilterChange={setSearch}
          toolbar={registerButton}
          renderItem={(addon) => (
            <MarketplaceCard
              addon={addon}
              installed={installedByDefinition.get(addon._id)}
              installing={install.isPending && install.variables?.marketplaceId === addon._id}
              canInstall={installed.isSuccess && !install.isPending}
              onInstall={() => startInstall(addon)}
              onDetails={() => setDetails(addon)}
              onDelete={() => setDeleting(addon)}
            />
          )}
          emptyState={
            <EmptyState
              icon={<StoreIcon />}
              title="The marketplace is empty"
              description="Register an addon definition to make it available here."
            />
          }
          noResultsState={
            <EmptyState
              icon={<SearchXIcon />}
              title="No addons match your search"
              description="Try another name or image."
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
        installed={details ? installedByDefinition.get(details._id) : undefined}
        canInstall={installed.isSuccess && !install.isPending}
        onInstall={startInstall}
      />
      <RegisterAddonDialog open={registerOpen} onOpenChange={setRegisterOpen} />
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
        title={`Delete ${deleting?.name ?? 'definition'} from the marketplace?`}
        description={
          deletingInstalled
            ? `${deleting?.name} is installed. It keeps running, but the definition is gone, so it cannot be installed again until it is registered anew.`
            : 'The definition is removed and can no longer be installed. Registering it again requires a new review.'
        }
        confirmLabel="Delete definition"
        destructive
        pending={deleteDefinition.isPending}
        onConfirm={() => {
          if (deleting) {
            deleteDefinition.mutate(
              { id: deleting._id, name: deleting.name },
              { onSettled: () => setDeleting(null) },
            );
          }
        }}
      />
    </div>
  );
}
