import { useSearchParam } from '@oakestra/dashboard-sdk';
import {
  isProblemAddonStatus,
  isTransitionalAddonStatus,
  type ConsentRequest,
  type InstalledAddon,
} from '@oakestra/api';
import {
  Button,
  ConfirmDialog,
  EmptyState,
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
  QueryErrorAlert,
  SourceTag,
  plural,
  stretchedLinkClassName,
} from '@oakestra/ui';
import { DataList, type DataListSortOption } from '@oakestra/ui/data-table';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowUpCircleIcon,
  LoaderCircleIcon,
  PowerOffIcon,
  PuzzleIcon,
  ShieldCheckIcon,
  StoreIcon,
  Trash2Icon,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { useStore } from 'zustand';

import type { AddonEntry } from '../../../core/addons/addon-registry';
import { useAddonRegistry } from '../../../core/addons/addon-registry-context';
import { useAddonsAdminApi } from '../../../core/addons/addons-admin';
import { addonAction, canApprove, canUpdate, type AddonAction } from '../addon-action';
import { useApproveAddon, useDisableAddon, useRemoveAddon, useUpdateAddon } from '../api/mutations';
import { installedAddonsQuery, useStuckAddonIds } from '../api/queries';
import { AddonDetailSheet } from '../components/AddonDetailSheet';
import { QualifiedName } from '../components/AddonHeading';
import { AddonIcon } from '../components/AddonIcon';
import { ConsentDialog } from '../components/ConsentDialog';
import { useConsentReview } from '../components/use-consent-review';
import { AddonStatusBadge, addonStatusLabel } from '../components/AddonStatusBadge';
import { DashboardUiBadge } from '../components/DashboardUiBadge';
import { UnmatchedDashboardUis } from '../components/UnmatchedDashboardUis';
import { addonTitle, hasDisplayName } from '../display';
import { MARKETPLACE_PATH } from '../paths';

const searchValue = (addon: InstalledAddon) =>
  [
    addon.display_name,
    addon.name,
    addon.description,
    addon.category,
    ...addon.tags,
    addon.source.name,
    addonStatusLabel(addon.status),
  ]
    .filter(Boolean)
    .join(' ');

const SORT_OPTIONS: readonly DataListSortOption<InstalledAddon>[] = [
  { id: 'name', label: 'Name', value: (addon) => addonTitle(addon).toLowerCase() },
  { id: 'status', label: 'Status', value: (addon) => addonStatusLabel(addon.status) },
  {
    id: 'services',
    label: 'Most services',
    value: (addon) => addon.services.length,
    desc: true,
  },
];

/**
 * Under the badge, so a broken addon explains itself in the list: the engine's reason (a policy
 * violation, a bad grant signature, an image that cannot be pulled) or "1 of 2 services failing".
 */
function problemHint(addon: InstalledAddon): string | null {
  if (!isProblemAddonStatus(addon.status)) return null;
  if (addon.status_details?.message) return addon.status_details.message;
  const failing = addon.status_details?.failed_services.length ?? 0;
  if (failing === 0) return null;
  return `${failing} of ${plural(addon.services.length, 'service')} failing`;
}

type Pending = { kind: AddonAction; addon: InstalledAddon };

type ConsentKind = 'update' | 'approve';

const CONSENT_COPY = {
  update: (addon: InstalledAddon, request: ConsentRequest) => ({
    title: `Update ${addonTitle(addon)} to ${request.definition.version}?`,
    qualifiedName: addon.qualified_name,
    description:
      'Its containers are replaced by the new version below. Volumes and their data are kept.',
    confirmLabel: 'Accept and update',
  }),
  approve: (addon: InstalledAddon) => ({
    title: `Approve ${addonTitle(addon)} again?`,
    qualifiedName: addon.qualified_name,
    description:
      'Approving signs the grant again for this definition. A failed addon is deployed again.',
    confirmLabel: 'Accept and approve',
  }),
} as const;

const CONFIRM_COPY: Readonly<
  Record<
    AddonAction,
    {
      title: (addon: InstalledAddon) => string;
      description: string;
      confirmLabel: string;
      destructive: boolean;
    }
  >
> = {
  disable: {
    title: (addon) => `Disable ${addonTitle(addon)}?`,
    description:
      'All containers of this addon are stopped and its dashboard UI disappears. You can remove it afterwards.',
    confirmLabel: 'Disable addon',
    destructive: true,
  },
  'force-disable': {
    title: (addon) => `Disable ${addonTitle(addon)} anyway?`,
    description:
      'This addon has been installing or updating for a long time. Disabling it now stops its containers, but the reconcile loop may still be working on it and can overwrite the status afterwards. Check the list again once it settled.',
    confirmLabel: 'Disable anyway',
    destructive: true,
  },
  remove: {
    title: (addon) => `Remove ${addonTitle(addon)}?`,
    description:
      'The addon record is deleted from this platform. Its volumes stay on the host, so a later install finds its data again.',
    confirmLabel: 'Remove addon',
    destructive: true,
  },
};

function InstalledAddonItem({
  addon,
  uiEntry,
  stuck,
  busy,
  working,
  onOpen,
  onAction,
  onUpdate,
  onApprove,
}: {
  addon: InstalledAddon;
  uiEntry: AddonEntry | undefined;
  stuck: boolean;
  /** An update or approval of this page is in flight. */
  busy: boolean;
  /** Which of this addon's consent calls is in flight, for the spinner on its button. */
  working: ConsentKind | null;
  onOpen: () => void;
  onAction: (kind: AddonAction) => void;
  onUpdate: () => void;
  onApprove: () => void;
}) {
  const action = addonAction(addon, stuck);
  const transitional = isTransitionalAddonStatus(addon.status);
  const hint = problemHint(addon);
  return (
    <Item data-testid={`installed-addon-${addon.name}`}>
      <ItemMedia>
        <AddonIcon icon={addon.icon} size="sm" />
      </ItemMedia>
      <ItemContent className="basis-64">
        <ItemTitle>
          <button
            type="button"
            aria-label={hasDisplayName(addon) ? `${addonTitle(addon)} (${addon.name})` : undefined}
            className={`cursor-pointer truncate ${stretchedLinkClassName}`}
            onClick={onOpen}
          >
            {addonTitle(addon)}
          </button>
          <AddonStatusBadge status={addon.status} />
        </ItemTitle>
        <QualifiedName addon={addon} />
        {hint ? (
          <span className="text-muted-foreground line-clamp-2 text-xs break-words">{hint}</span>
        ) : null}
        <ItemDescription>{addon.description || 'No description'}</ItemDescription>
      </ItemContent>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
        <span className="flex items-center gap-2">
          <span className="text-muted-foreground tabular-nums">v{addon.version}</span>
          <SourceTag name={addon.source.name} />
        </span>
        <span className="text-muted-foreground tabular-nums">
          {plural(addon.services.length, 'service')}
        </span>
        {/* Above the row's button: a failed UI explains itself in a tooltip on the badge. */}
        <span className="relative z-10 flex items-center gap-2">
          <span className="text-muted-foreground">Dashboard UI</span>
          <DashboardUiBadge entry={uiEntry} />
        </span>
      </div>
      <ItemActions className="ml-auto">
        {canApprove(addon) ? (
          <Button
            variant="outline"
            size="sm"
            aria-label={`Approve ${addon.name} again`}
            disabled={busy}
            onClick={onApprove}
          >
            {working === 'approve' ? (
              <LoaderCircleIcon className="animate-spin" aria-hidden />
            ) : (
              <ShieldCheckIcon aria-hidden />
            )}
            Approve
          </Button>
        ) : null}
        {canUpdate(addon) ? (
          <Button
            variant="outline"
            size="sm"
            aria-label={`Update ${addon.name} to ${addon.latest_version}`}
            disabled={busy}
            onClick={onUpdate}
          >
            {working === 'update' ? (
              <LoaderCircleIcon className="animate-spin" aria-hidden />
            ) : (
              <ArrowUpCircleIcon aria-hidden />
            )}
            Update to {addon.latest_version}
          </Button>
        ) : null}
        {action === 'force-disable' ? (
          <Button
            variant="outline"
            size="sm"
            aria-label={`Disable ${addon.name} anyway`}
            onClick={() => onAction(action)}
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
            onClick={() => onAction(action)}
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
            onClick={() => onAction('disable')}
          >
            <PowerOffIcon aria-hidden />
            Disable
          </Button>
        )}
      </ItemActions>
    </Item>
  );
}

export function InstalledPage() {
  const api = useAddonsAdminApi();
  const installed = useQuery(installedAddonsQuery(api));
  const registry = useAddonRegistry();
  const uiEntries = useStore(registry, (state) => state.entries);

  const [selectedId, setSelectedId] = useSearchParam('addon');
  const [search, setSearch] = useSearchParam('q');

  const [pending, setPending] = useState<Pending | null>(null);
  const consent = useConsentReview<{ kind: ConsentKind; addon: InstalledAddon }>();
  const disable = useDisableAddon();
  const remove = useRemoveAddon();
  const update = useUpdateAddon();
  const approve = useApproveAddon();
  const busy = update.isPending || approve.isPending;
  const workingOn = (addon: InstalledAddon): ConsentKind | null => {
    if (update.isPending && update.variables.id === addon._id) return 'update';
    if (approve.isPending && approve.variables.id === addon._id) return 'approve';
    return null;
  };

  const addons = installed.data;
  const stuckIds = useStuckAddonIds(api, addons);
  const selected = addons?.find((addon) => addon._id === selectedId);

  const unmatched = useMemo(() => {
    // Wait for the list: before it arrives every UI would look unmatched.
    if (!addons) return [];
    // `/ui-addons` names addons by id (`<tap>--<name>` for non-official ones).
    const names = new Set(addons.map((addon) => addon.addon_id));
    return (
      Object.values(uiEntries)
        // Linked addons are part of the shell build, like core modules, so not addons to manage.
        .filter((entry) => entry.origin !== 'linked' && !names.has(entry.name))
        .sort((a, b) => a.name.localeCompare(b.name))
    );
  }, [addons, uiEntries]);

  // While the dialog animates closed `pending` is already null; the disable copy stands in.
  const confirmCopy = CONFIRM_COPY[pending?.kind ?? 'disable'];

  // The first call goes without a hash: the catalog serves none, the backend's 409 brings the
  // definition the dialog shows.
  function run(kind: ConsentKind, addon: InstalledAddon, acceptDefinition?: string) {
    const mutation = kind === 'update' ? update : approve;
    mutation.mutate(
      { id: addon._id, name: addonTitle(addon), acceptDefinition },
      {
        onSuccess: (outcome) =>
          consent.show({ kind, addon }, outcome, (request) => CONSENT_COPY[kind](addon, request)),
        onError: consent.clear,
      },
    );
  }

  const confirm = () => {
    if (!pending) return;
    const target = { id: pending.addon._id, name: addonTitle(pending.addon) };
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
        <DataList
          label="Installed addons"
          noun="addon"
          data={addons}
          getRowId={(addon) => addon._id}
          isLoading={installed.isPending}
          searchValue={searchValue}
          sortOptions={SORT_OPTIONS}
          searchPlaceholder="Search installed addons"
          globalFilter={search}
          onGlobalFilterChange={setSearch}
          renderItem={(addon) => (
            <InstalledAddonItem
              addon={addon}
              uiEntry={uiEntries[addon.addon_id]}
              stuck={stuckIds.has(addon._id)}
              busy={busy}
              working={workingOn(addon)}
              onOpen={() => setSelectedId(addon._id)}
              onAction={(kind) => setPending({ kind, addon })}
              onUpdate={() => run('update', addon)}
              onApprove={() => run('approve', addon)}
            />
          )}
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
        uiEntry={selected ? uiEntries[selected.addon_id] : undefined}
        stuck={selected ? stuckIds.has(selected._id) : false}
        busy={busy}
        working={selected ? workingOn(selected) : null}
        onClose={() => setSelectedId('')}
        onAction={(kind, addon) => setPending({ kind, addon })}
        onUpdate={(addon) => run('update', addon)}
        onApprove={(addon) => run('approve', addon)}
      />

      <ConsentDialog
        review={consent.review}
        pending={busy}
        onCancel={consent.clear}
        onConfirm={(hash) => {
          if (consent.review) run(consent.review.target.kind, consent.review.target.addon, hash);
        }}
      />

      <ConfirmDialog
        open={pending !== null}
        onOpenChange={(open) => {
          if (!open) setPending(null);
        }}
        title={pending ? confirmCopy.title(pending.addon) : ''}
        description={confirmCopy.description}
        confirmLabel={confirmCopy.confirmLabel}
        destructive={confirmCopy.destructive}
        pending={disable.isPending || remove.isPending}
        onConfirm={confirm}
      />
    </div>
  );
}
