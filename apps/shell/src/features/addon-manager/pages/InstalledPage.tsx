import { isTransitionalAddonStatus, type InstalledAddon } from '@oakestra/api';
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Button,
  ConfirmDialog,
  EmptyState,
  useIsMobile,
} from '@oakestra/ui';
import { createDataTableColumnHelper, DataTable } from '@oakestra/ui/data-table';
import { useQuery } from '@tanstack/react-query';
import { PowerOffIcon, PuzzleIcon, StoreIcon, Trash2Icon } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { useStore } from 'zustand';

import { useAddonRegistry } from '../../../core/addons/addon-registry-context';
import { useAddonsAdminApi } from '../../../core/addons/addons-admin';
import { describeError } from '../../../core/api/errors';
import { useDisableAddon, useRemoveAddon } from '../api/mutations';
import { installedAddonsQuery, useStuckAddonIds } from '../api/queries';
import { AddonDetailSheet } from '../components/AddonDetailSheet';
import { AddonStatusBadge, addonStatusLabel } from '../components/AddonStatusBadge';
import { DashboardUiBadge } from '../components/DashboardUiBadge';
import { UnmatchedDashboardUis } from '../components/UnmatchedDashboardUis';

const column = createDataTableColumnHelper<InstalledAddon>();

type Pending = { kind: 'disable' | 'force-disable' | 'remove'; addon: InstalledAddon };

export function InstalledPage() {
  const api = useAddonsAdminApi();
  const installed = useQuery(installedAddonsQuery(api));
  const compact = useIsMobile();
  const registry = useAddonRegistry();
  const uiEntries = useStore(registry, (state) => state.entries);

  const [params, setParams] = useSearchParams();
  const selectedId = params.get('addon');
  const search = params.get('q') ?? '';
  const setParam = (key: string, value: string | null) =>
    setParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        if (value) next.set(key, value);
        else next.delete(key);
        return next;
      },
      { replace: true },
    );

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
    return Object.values(uiEntries)
      .filter((entry) => !names.has(entry.name))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [addons, uiEntries]);

  const columns = useMemo(
    () =>
      column.columns([
        column.accessor('name', {
          header: 'Name',
          cell: (info) => <span className="font-medium">{info.getValue()}</span>,
        }),
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
          cell: ({ row }) => <AddonStatusBadge status={row.original.status} />,
        }),
        // Phones keep name, status and UI visible; the sheet has everything else.
        ...(compact
          ? []
          : [
              column.accessor((addon) => addon.services.length, {
                id: 'services',
                header: 'Services',
              }),
            ]),
        column.display({
          id: 'ui',
          header: 'Dashboard UI',
          cell: ({ row }) => <DashboardUiBadge entry={uiEntries[row.original.name]} />,
        }),
        column.display({
          id: 'actions',
          header: () => <span className="sr-only">Actions</span>,
          cell: ({ row }) => {
            const addon = row.original;
            const transitional = isTransitionalAddonStatus(addon.status);
            const stuckInstall = addon.status === 'installing' && stuckIds.has(addon._id);
            return (
              <div className="flex justify-end gap-1">
                {stuckInstall ? (
                  <Button
                    variant="outline"
                    size="sm"
                    aria-label={`Disable ${addon.name} anyway`}
                    onClick={() => setPending({ kind: 'force-disable', addon })}
                  >
                    <PowerOffIcon aria-hidden />
                    Disable anyway
                  </Button>
                ) : addon.status === 'disabled' ? (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Remove ${addon.name}`}
                    onClick={() => setPending({ kind: 'remove', addon })}
                  >
                    <Trash2Icon aria-hidden />
                  </Button>
                ) : (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Disable ${addon.name}`}
                    disabled={transitional}
                    title={transitional ? 'Wait until the current change has finished' : undefined}
                    onClick={() => setPending({ kind: 'disable', addon })}
                  >
                    <PowerOffIcon aria-hidden />
                  </Button>
                )}
              </div>
            );
          },
        }),
      ]),
    [uiEntries, compact, stuckIds],
  );

  const confirm = () => {
    if (!pending) return;
    const target = { id: pending.addon._id, name: pending.addon.name };
    const mutation = pending.kind === 'remove' ? remove : disable;
    mutation.mutate(target, {
      onSettled: () => setPending(null),
      onSuccess: () => {
        if (pending.kind === 'remove' && selectedId === target.id) setParam('addon', null);
      },
    });
  };

  return (
    <div className="space-y-6">
      {installed.isError ? (
        <Alert variant="destructive" data-testid="installed-error">
          <AlertTitle>
            {addons
              ? 'Could not refresh the installed addons'
              : 'Could not load the installed addons'}
          </AlertTitle>
          <AlertDescription>
            <p>
              {describeError(installed.error)}
              {addons ? ' The list below may be out of date.' : null}
            </p>
            <Button
              size="sm"
              variant="outline"
              className="mt-2"
              onClick={() => void installed.refetch()}
            >
              Try again
            </Button>
          </AlertDescription>
        </Alert>
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
          onGlobalFilterChange={(value) => setParam('q', value)}
          initialSorting={[{ id: 'name', desc: false }]}
          onRowClick={(addon) => setParam('addon', addon._id)}
          emptyState={
            <EmptyState
              icon={<PuzzleIcon />}
              title="No addons installed"
              description="Browse the marketplace to install your first addon."
              action={
                <Button asChild>
                  <Link to="/addon-manager/marketplace">
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
        onClose={() => setParam('addon', null)}
        onDisable={(addon) => setPending({ kind: 'disable', addon })}
        onForceDisable={(addon) => setPending({ kind: 'force-disable', addon })}
        onRemove={(addon) => setPending({ kind: 'remove', addon })}
      />

      <ConfirmDialog
        open={pending !== null}
        onOpenChange={(open) => {
          if (!open) setPending(null);
        }}
        title={
          pending?.kind === 'remove'
            ? `Remove ${pending.addon.name}?`
            : pending?.kind === 'force-disable'
              ? `Disable ${pending.addon.name} anyway?`
              : `Disable ${pending?.addon.name ?? 'addon'}?`
        }
        description={
          pending?.kind === 'remove'
            ? 'The addon is deleted from this platform. You can install it again from the marketplace.'
            : pending?.kind === 'force-disable'
              ? 'This addon has been installing for a long time. Disabling it now stops its containers, but the addons monitor may still be working on the installation and can overwrite the status afterwards. Check the list again once it settled.'
              : 'All containers of this addon are stopped and its dashboard UI disappears. You can remove it afterwards.'
        }
        confirmLabel={
          pending?.kind === 'remove'
            ? 'Remove addon'
            : pending?.kind === 'force-disable'
              ? 'Disable anyway'
              : 'Disable addon'
        }
        destructive
        pending={disable.isPending || remove.isPending}
        onConfirm={confirm}
      />
    </div>
  );
}
