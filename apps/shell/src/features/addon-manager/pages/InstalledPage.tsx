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
  DropdownMenuItem,
  DropdownMenuSeparator,
  EmptyState,
  Item,
  ItemContent,
  ItemTitle,
  QueryErrorAlert,
  RowMenu,
  SourceTag,
  cn,
  plural,
  stretchedLinkClassName,
} from '@oakestra/ui';
import { DataList, type DataListSortOption } from '@oakestra/ui/data-table';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowUpCircleIcon,
  InfoIcon,
  PanelsTopLeftIcon,
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
import {
  ADDON_ACTION_UI,
  addonAction,
  canApprove,
  canUpdate,
  type AddonAction,
} from '../addon-action';
import { useApproveAddon, useDisableAddon, useRemoveAddon, useUpdateAddon } from '../api/mutations';
import { installedAddonsQuery, useStuckAddonIds } from '../api/queries';
import { AddonDetailDialog } from '../components/AddonDetailDialog';
import { QualifiedName } from '../components/AddonHeading';
import { AddonIcon } from '../components/AddonIcon';
import { ConsentDialog } from '../components/ConsentDialog';
import { StateButton } from '../components/StateButton';
import { useConsentReview } from '../components/use-consent-review';
import { addonStatusLabel } from '../components/AddonStatusBadge';
import { DashboardUiBadge } from '../components/DashboardUiBadge';
import { OfficialMark } from '../components/OfficialMark';
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
    }
  >
> = {
  disable: {
    title: (addon) => `Disable ${addonTitle(addon)}?`,
    description:
      'All containers of this addon are stopped and its dashboard UI disappears. You can remove it afterwards.',
    confirmLabel: 'Disable addon',
  },
  'force-disable': {
    title: (addon) => `Disable ${addonTitle(addon)} anyway?`,
    description:
      'This addon has been installing or updating for a long time. Disabling it now stops its containers, but the reconcile loop may still be working on it and can overwrite the status afterwards. Check the list again once it settled.',
    confirmLabel: 'Disable anyway',
  },
  remove: {
    title: (addon) => `Remove ${addonTitle(addon)}?`,
    description:
      'The addon record is deleted from this platform. Its volumes stay on the host, so a later install finds its data again.',
    confirmLabel: 'Remove addon',
  },
};

// Fixed columns, so the state buttons line up whatever the meta line holds. Below sm the state
// moves under the meta line.
const ROW_GRID =
  'grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 sm:grid-cols-[auto_minmax(0,1fr)_11rem_auto]';

/**
 * The addon's state and the one action that answers it, as a StateButton: a failure offers
 * Approve, a newer version Update, a stuck install Disable anyway, a disabled addon Remove. The
 * rest of the actions are in the row menu.
 */
function AddonStateButton({
  addon,
  stuck,
  busy,
  working,
  onOpen,
  onAction,
  onUpdate,
  onApprove,
}: {
  addon: InstalledAddon;
  stuck: boolean;
  busy: boolean;
  working: ConsentKind | null;
  onOpen: () => void;
  onAction: (kind: AddonAction) => void;
  onUpdate: () => void;
  onApprove: () => void;
}) {
  const hint = problemHint(addon);
  const testId = `addon-state-${addon.name}`;
  if (working) {
    return (
      <StateButton tone="info" state={working === 'update' ? 'Updating' : 'Approving'} pending />
    );
  }
  if (isTransitionalAddonStatus(addon.status)) {
    const label = addonStatusLabel(addon.status);
    if (addonAction(addon, stuck) === 'force-disable') {
      return (
        <StateButton
          tone="warning"
          state={`Still ${label.toLowerCase()}`}
          action={{
            label: 'Disable anyway',
            icon: PowerOffIcon,
            ariaLabel: `Disable ${addon.name} anyway`,
            onClick: () => onAction('force-disable'),
          }}
          hint="This has been running for more than two minutes. The reconcile loop may still be working on it."
          data-testid={testId}
        />
      );
    }
    return <StateButton tone="info" state={label} pending data-testid={testId} />;
  }
  if (canApprove(addon)) {
    return (
      <StateButton
        tone="destructive"
        state={addonStatusLabel(addon.status)}
        action={{
          label: 'Approve again',
          icon: ShieldCheckIcon,
          ariaLabel: `Approve ${addon.name} again`,
          onClick: onApprove,
        }}
        disabled={busy}
        hint={
          <>
            {hint ? <span className="block font-medium">{hint}</span> : null}
            Approving signs the grant again and deploys the addon again.
          </>
        }
        data-testid={testId}
      />
    );
  }
  if (addon.status === 'partially_active') {
    // A problem outranks an update; the update stays in the menu.
    return (
      <StateButton
        tone="warning"
        state={addonStatusLabel(addon.status)}
        action={{
          label: 'Show details',
          icon: InfoIcon,
          ariaLabel: `Details of ${addon.name}`,
          onClick: onOpen,
        }}
        hint={hint ?? undefined}
        data-testid={testId}
      />
    );
  }
  if (canUpdate(addon)) {
    return (
      <StateButton
        tone="info"
        state={`${addon.latest_version} available`}
        stateIcon={ArrowUpCircleIcon}
        action={{
          label: `Update to ${addon.latest_version}`,
          icon: ArrowUpCircleIcon,
          ariaLabel: `Update ${addon.name} to ${addon.latest_version}`,
          onClick: onUpdate,
        }}
        disabled={busy}
        hint={`Running ${addon.version}. Updating shows what changes before anything happens.`}
        data-testid={testId}
      />
    );
  }
  if (addon.status === 'disabled') {
    return (
      <StateButton
        tone="neutral"
        state="Disabled"
        action={{
          label: 'Remove',
          icon: Trash2Icon,
          ariaLabel: `Remove ${addon.name}`,
          onClick: () => onAction('remove'),
        }}
        hint="Stopped. Removing deletes the record; its volumes stay on the host."
        data-testid={testId}
      />
    );
  }
  return <StateButton tone="success" state={addonStatusLabel(addon.status)} data-testid={testId} />;
}

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
  const ActionIcon = ADDON_ACTION_UI[action].icon;
  const transitional = isTransitionalAddonStatus(addon.status);
  return (
    <Item data-testid={`installed-addon-${addon.name}`}>
      <div className={ROW_GRID}>
        <AddonIcon icon={addon.icon} name={addonTitle(addon)} />
        <ItemContent className="min-w-0 gap-0.5">
          <ItemTitle className="flex min-w-0 items-center gap-1.5">
            <button
              type="button"
              aria-label={
                hasDisplayName(addon) ? `${addonTitle(addon)} (${addon.name})` : undefined
              }
              className={cn('cursor-pointer truncate', stretchedLinkClassName)}
              onClick={onOpen}
            >
              {addonTitle(addon)}
            </button>
            <OfficialMark source={addon.source} />
          </ItemTitle>
          <div className="text-muted-foreground flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs">
            <QualifiedName addon={addon} className="inline" />
            <span className="tabular-nums">v{addon.version}</span>
            <SourceTag name={addon.source.name} />
            <span aria-hidden>·</span>
            <span className="tabular-nums">{plural(addon.services.length, 'service')}</span>
            {uiEntry ? (
              // Above the row's button: a failed UI explains itself in a tooltip on the badge.
              <span className="relative z-10 flex items-center gap-1.5">
                <span aria-hidden>·</span>
                <PanelsTopLeftIcon className="size-3.5" aria-hidden />
                <span className="sr-only">Dashboard UI</span>
                <DashboardUiBadge entry={uiEntry} />
              </span>
            ) : null}
            {/* Shown here when the state button is busy with a problem instead. */}
            {addon.update_available && addon.status !== 'active' ? (
              <span className="flex items-center gap-1">
                <span aria-hidden>·</span>
                <ArrowUpCircleIcon className="size-3.5" aria-hidden />
                {addon.latest_version} available
              </span>
            ) : null}
          </div>
        </ItemContent>
        <div className="relative z-10 col-start-2 row-start-2 w-44 sm:col-start-3 sm:row-start-1 sm:w-auto">
          <AddonStateButton
            addon={addon}
            stuck={stuck}
            busy={busy}
            working={working}
            onOpen={onOpen}
            onAction={onAction}
            onUpdate={onUpdate}
            onApprove={onApprove}
          />
        </div>
        <div className="relative z-10 col-start-3 row-start-1 sm:col-start-4">
          <RowMenu label={`More actions for ${addon.name}`}>
            <DropdownMenuItem onSelect={onOpen}>
              <InfoIcon aria-hidden />
              Details
            </DropdownMenuItem>
            {canUpdate(addon) ? (
              <DropdownMenuItem
                disabled={busy}
                aria-label={`Update ${addon.name} to ${addon.latest_version}`}
                onSelect={onUpdate}
              >
                <ArrowUpCircleIcon aria-hidden />
                Update to {addon.latest_version}
              </DropdownMenuItem>
            ) : null}
            {canApprove(addon) ? (
              <DropdownMenuItem
                disabled={busy}
                aria-label={`Approve ${addon.name} again`}
                onSelect={onApprove}
              >
                <ShieldCheckIcon aria-hidden />
                Approve again
              </DropdownMenuItem>
            ) : null}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              aria-label={
                action === 'force-disable'
                  ? `Disable ${addon.name} anyway`
                  : `${ADDON_ACTION_UI[action].label} ${addon.name}`
              }
              // A plain disable waits for the running change; a stuck one may force it.
              disabled={action === 'disable' && transitional}
              onSelect={() => onAction(action)}
            >
              <ActionIcon aria-hidden />
              {ADDON_ACTION_UI[action].label}
            </DropdownMenuItem>
          </RowMenu>
        </div>
      </div>
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

      <AddonDetailDialog
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
        destructive
        pending={disable.isPending || remove.isPending}
        onConfirm={confirm}
      />
    </div>
  );
}
