import { useSearchParam } from '@oakestra/dashboard-sdk';
import { isTransitionalAddonStatus, type InstalledAddon } from '@oakestra/api';
import {
  Button,
  ConfirmDialog,
  EmptyState,
  useIsMobile,
  QueryErrorAlert,
  plural,
} from '@oakestra/ui';
import { createDataTableColumnHelper, DataTable } from '@oakestra/ui/data-table';
import { useQuery } from '@tanstack/react-query';
import { PowerOffIcon, PuzzleIcon, StoreIcon, Trash2Icon } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { useStore } from 'zustand';

import { useAddonRegistry } from '../../../core/addons/addon-registry-context';
import { useAddonsAdminApi } from '../../../core/addons/addons-admin';
import { addonAction, type AddonAction } from '../addon-action';
import { useDisableAddon, useRemoveAddon } from '../api/mutations';
import { installedAddonsQuery, useStuckAddonIds } from '../api/queries';
import { AddonDetailSheet } from '../components/AddonDetailSheet';
import { AddonStatusBadge, addonStatusLabel } from '../components/AddonStatusBadge';
import { DashboardUiBadge } from '../components/DashboardUiBadge';
import { UnmatchedDashboardUis } from '../components/UnmatchedDashboardUis';
import { MARKETPLACE_PATH } from '../paths';

const column = createDataTableColumnHelper<InstalledAddon>();

/** "1 of 2 services failing" under the badge, so a broken addon explains itself in the list. */
function failingServicesHint(addon: InstalledAddon): string | null {
  if (addon.status !== 'failed' && addon.status !== 'partially_active') return null;
  const failing = addon.status_details?.failed_services.length ?? 0;
  if (failing === 0) return null;
  return `${failing} of ${plural(addon.services.length, 'service')} failing`;
}

type Pending = { kind: AddonAction; addon: InstalledAddon };

const CONFIRM_COPY: Readonly<
  Record<
    AddonAction,
    { title: (name: string) => string; description: string; confirmLabel: string }
  >
> = {
  disable: {
    title: (name) => `Disable ${name}?`,
    description:
      'All containers of this addon are stopped and its dashboard UI disappears. You can remove it afterwards.',
    confirmLabel: 'Disable addon',
  },
  'force-disable': {
    title: (name) => `Disable ${name} anyway?`,
    description:
      'This addon has been installing for a long time. Disabling it now stops its containers, but the addons monitor may still be working on the installation and can overwrite the status afterwards. Check the list again once it settled.',
    confirmLabel: 'Disable anyway',
  },
  remove: {
    title: (name) => `Remove ${name}?`,
    description:
      'The addon is deleted from this platform. You can install it again from the marketplace.',
    confirmLabel: 'Remove addon',
  },
};

export function InstalledPage() {
  const api = useAddonsAdminApi();
  const installed = useQuery(installedAddonsQuery(api));
  const compact = useIsMobile();
  const registry = useAddonRegistry();
  const uiEntries = useStore(registry, (state) => state.entries);

  const [selectedId, setSelectedId] = useSearchParam('addon');
  const [search, setSearch] = useSearchParam('q');

  const [pending, setPending] = useState<Pending | null>(null);
  const disable = useDisableAddon();
  const remove = useRemoveAddon();

  const addons = installed.data;
  const stuckIds = useStuckAddonIds(api, addons);
  const selected = addons?.find((addon) => addon._id === selectedId);

  const unmatched = useMemo(() => {
    // Wait for the list: before it arrives every UI would look unmatched.
    if (!addons) return [];
    const names = new Set(addons.map((addon) => addon.name));
    return (
      Object.values(uiEntries)
        // Linked addons are part of the shell build, like core modules, so not addons to manage.
        .filter((entry) => entry.origin !== 'linked' && !names.has(entry.name))
        .sort((a, b) => a.name.localeCompare(b.name))
    );
  }, [addons, uiEntries]);

  const columns = useMemo(
    () =>
      column.columns([
        column.accessor('name', {
          header: 'Name',
          cell: (info) => <span className="font-medium">{info.getValue()}</span>,
        }),
        // Phones keep name, status and the actions; the sheet has everything else.
        ...(compact
          ? []
          : [
              column.accessor('description', {
                header: 'Description',
                enableSorting: false,
                cell: (info) => (
                  <span className="text-muted-foreground line-clamp-2 max-w-sm whitespace-normal">
                    {info.getValue() || '-'}
                  </span>
                ),
              }),
            ]),
        column.accessor((addon) => addonStatusLabel(addon.status), {
          id: 'status',
          header: 'Status',
          cell: ({ row }) => {
            const hint = failingServicesHint(row.original);
            return (
              <div className="flex flex-col items-start gap-1">
                <AddonStatusBadge status={row.original.status} />
                {hint ? <span className="text-muted-foreground text-xs">{hint}</span> : null}
              </div>
            );
          },
        }),
        ...(compact
          ? []
          : [
              column.accessor((addon) => addon.services.length, {
                id: 'services',
                header: 'Services',
              }),
              column.display({
                id: 'ui',
                header: 'Dashboard UI',
                cell: ({ row }) => <DashboardUiBadge entry={uiEntries[row.original.name]} />,
              }),
            ]),
        column.display({
          id: 'actions',
          header: () => <span className="sr-only">Actions</span>,
          cell: ({ row }) => {
            const addon = row.original;
            const action = addonAction(addon, stuckIds.has(addon._id));
            const transitional = isTransitionalAddonStatus(addon.status);
            return (
              <div className="flex justify-end gap-1">
                {action === 'force-disable' ? (
                  <Button
                    variant="outline"
                    size="sm"
                    aria-label={`Disable ${addon.name} anyway`}
                    onClick={() => setPending({ kind: action, addon })}
                  >
                    <PowerOffIcon aria-hidden />
                    Disable anyway
                  </Button>
                ) : action === 'remove' ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    aria-label={`Remove ${addon.name}`}
                    onClick={() => setPending({ kind: action, addon })}
                  >
                    <Trash2Icon aria-hidden />
                    Remove
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    aria-label={`Disable ${addon.name}`}
                    disabled={transitional}
                    title={transitional ? 'Wait until the current change has finished' : undefined}
                    onClick={() => setPending({ kind: 'disable', addon })}
                  >
                    <PowerOffIcon aria-hidden />
                    Disable
                  </Button>
                )}
              </div>
            );
          },
        }),
      ]),
    [uiEntries, compact, stuckIds],
  );

  // While the dialog animates closed `pending` is already null; the disable copy stands in.
  const confirmCopy = CONFIRM_COPY[pending?.kind ?? 'disable'];

  const confirm = () => {
    if (!pending) return;
    const target = { id: pending.addon._id, name: pending.addon.name };
    const mutation = pending.kind === 'remove' ? remove : disable;
    mutation.mutate(target, {
      onSettled: () => setPending(null),
      onSuccess: () => {
        if (pending.kind === 'remove' && selectedId === target.id) setSelectedId('');
      },
    });
  };

  return (
    <div className="space-y-6">
      {installed.isError ? (
        <QueryErrorAlert
          data-testid="installed-error"
          title={
            addons
              ? 'Could not refresh the installed addons'
              : 'Could not load the installed addons'
          }
          error={installed.error}
          onRetry={() => void installed.refetch()}
        >
          {addons ? ' The list below may be out of date.' : null}
        </QueryErrorAlert>
      ) : null}
      {installed.isError && !addons ? null : (
        <DataTable
          label="Installed addons"
          columns={columns}
          data={addons}
          getRowId={(addon) => addon._id}
          isLoading={installed.isPending}
          searchPlaceholder="Search installed addons"
          globalFilter={search}
          onGlobalFilterChange={setSearch}
          initialSorting={[{ id: 'name', desc: false }]}
          onRowClick={(addon) => setSelectedId(addon._id)}
          emptyState={
            <EmptyState
              icon={<PuzzleIcon />}
              title="No addons installed"
              description="Browse the marketplace to install your first addon."
              action={
                <Button asChild>
                  <Link to={MARKETPLACE_PATH}>
                    <StoreIcon aria-hidden />
                    Open the marketplace
                  </Link>
                </Button>
              }
            />
          }
        />
      )}

      <UnmatchedDashboardUis entries={unmatched} />

      <AddonDetailSheet
        addon={selected}
        uiEntry={selected ? uiEntries[selected.name] : undefined}
        stuck={selected ? stuckIds.has(selected._id) : false}
        onClose={() => setSelectedId('')}
        onAction={(kind, addon) => setPending({ kind, addon })}
      />

      <ConfirmDialog
        open={pending !== null}
        onOpenChange={(open) => {
          if (!open) setPending(null);
        }}
        title={confirmCopy.title(pending?.addon.name ?? 'addon')}
        description={confirmCopy.description}
        confirmLabel={confirmCopy.confirmLabel}
        destructive
        pending={disable.isPending || remove.isPending}
        onConfirm={confirm}
      />
    </div>
  );
}
