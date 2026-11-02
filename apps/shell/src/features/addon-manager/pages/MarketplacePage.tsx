import type { MarketplaceAddon } from '@oakestra/api';
import { Button, ConfirmDialog, EmptyState, Input, Skeleton } from '@oakestra/ui';
import { useQuery } from '@tanstack/react-query';
import { PlusIcon, SearchIcon, StoreIcon } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';

import { QueryErrorAlert } from '../../../components/QueryErrorAlert';
import { useAddonsAdminApi } from '../../../core/addons/addons-admin';
import { useSearchParam } from '../../../lib/use-search-param';
import { useDeleteDefinition, useInstallAddon } from '../api/mutations';
import { installedAddonsQuery, marketplaceAddonsQuery } from '../api/queries';
import { MarketplaceCard } from '../components/MarketplaceCard';
import { MarketplaceDetailsDialog } from '../components/MarketplaceDetailsDialog';
import { RegisterAddonDialog } from '../components/RegisterAddonDialog';
import { INSTALLED_PATH } from '../paths';

function matches(addon: MarketplaceAddon, term: string): boolean {
  const haystack = [addon.name, addon.description, ...addon.services.map((s) => s.image)];
  return haystack.some((text) => text.toLowerCase().includes(term));
}

export function MarketplacePage() {
  const api = useAddonsAdminApi();
  const marketplace = useQuery(marketplaceAddonsQuery(api));
  const installed = useQuery(installedAddonsQuery(api));
  const navigate = useNavigate();

  const [query, setQuery] = useSearchParam('q');
  // The box keeps its own text: the router applies location changes asynchronously, so binding
  // the input straight to the URL would drop keystrokes typed in between. The URL only makes the
  // search linkable.
  const [search, setSearch] = useState(query);
  const [details, setDetails] = useState<MarketplaceAddon | null>(null);
  const [deleting, setDeleting] = useState<MarketplaceAddon | null>(null);
  const [registerOpen, setRegisterOpen] = useState(false);
  const install = useInstallAddon();
  const deleteDefinition = useDeleteDefinition();

  const installedByDefinition = useMemo(
    () => new Map((installed.data ?? []).map((addon) => [addon.marketplace_id, addon])),
    [installed.data],
  );
  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    const list = marketplace.data ?? [];
    return (term ? list.filter((addon) => matches(addon, term)) : list).toSorted((a, b) =>
      a.name.localeCompare(b.name),
    );
  }, [marketplace.data, search]);

  const deletingInstalled = deleting ? installedByDefinition.get(deleting._id) : undefined;

  function updateSearch(value: string) {
    setSearch(value);
    setQuery(value);
  }

  function startInstall(addon: MarketplaceAddon) {
    install.mutate(
      { marketplaceId: addon._id, name: addon.name },
      // The installed tab shows the progress of the new addon.
      { onSuccess: () => void navigate(INSTALLED_PATH) },
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full min-w-0 sm:max-w-xs sm:flex-1">
          <SearchIcon
            aria-hidden
            className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
          />
          <Input
            type="search"
            aria-label="Search the marketplace"
            placeholder="Search the marketplace"
            className="pl-9"
            value={search}
            onChange={(event) => updateSearch(event.target.value)}
          />
        </div>
        <Button className="sm:ml-auto" onClick={() => setRegisterOpen(true)}>
          <PlusIcon aria-hidden />
          Register addon
        </Button>
      </div>

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
        <QueryErrorAlert
          data-testid="marketplace-error"
          title="Could not load the marketplace"
          error={marketplace.error}
          onRetry={() => void marketplace.refetch()}
        />
      ) : marketplace.isPending ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-busy="true">
          {Array.from({ length: 3 }, (_, index) => (
            <Skeleton key={index} className="h-48 rounded-xl" />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <EmptyState
          icon={<StoreIcon />}
          title={search ? 'No addons match your search' : 'The marketplace is empty'}
          description={
            search
              ? 'Try another name or image.'
              : 'Register an addon definition to make it available here.'
          }
          action={
            search ? (
              <Button variant="outline" size="sm" onClick={() => updateSearch('')}>
                Clear search
              </Button>
            ) : undefined
          }
        />
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((addon) => (
            <li key={addon._id} className="flex min-w-0">
              <MarketplaceCard
                addon={addon}
                installed={installedByDefinition.get(addon._id)}
                installing={install.isPending && install.variables?.marketplaceId === addon._id}
                canInstall={installed.isSuccess && !install.isPending}
                onInstall={() => startInstall(addon)}
                onDetails={() => setDetails(addon)}
                onDelete={() => setDeleting(addon)}
              />
            </li>
          ))}
        </ul>
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
