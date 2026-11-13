import type { InstalledAddon } from '@oakestra/api';
import { isTransitionalAddonStatus } from '@oakestra/api';
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Button,
  CopyButton,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  ScrollArea,
  Separator,
} from '@oakestra/ui';
import {
  ArrowUpCircleIcon,
  LoaderCircleIcon,
  ShieldCheckIcon,
  type LucideIcon,
} from 'lucide-react';

import type { AddonEntry } from '../../../core/addons/addon-registry';
import {
  ADDON_ACTION_UI,
  addonAction,
  canApprove,
  canUpdate,
  type AddonAction,
} from '../addon-action';
import { AddonClassificationRows, AddonHeading } from './AddonHeading';
import { AddonStatusBadge } from './AddonStatusBadge';
import { DashboardUiBadge, dashboardUiProblem } from './DashboardUiBadge';
import { DefinitionDetails } from './DefinitionDetails';
import { navItemKeys, NavItemKeys } from './NavItemKeys';
import { PermissionList } from './PermissionList';
import { SourceLabel } from './SourceLabel';

interface AddonDetailDialogProps {
  addon: InstalledAddon | undefined;
  uiEntry: AddonEntry | undefined;
  onClose: () => void;
  /** Installing for so long that it is probably stuck. */
  stuck: boolean;
  onAction: (action: AddonAction, addon: InstalledAddon) => void;
  onUpdate: (addon: InstalledAddon) => void;
  onApprove: (addon: InstalledAddon) => void;
  /** An update or approval of this page is in flight. */
  busy: boolean;
  /** Which of this addon's consent calls is in flight, for the spinner on its button. */
  working: 'update' | 'approve' | null;
}

/** Same layout as MarketplaceDetailsDialog; keep the two in step. */
export function AddonDetailDialog({
  addon,
  uiEntry,
  onClose,
  stuck,
  onAction,
  onUpdate,
  onApprove,
  busy,
  working,
}: AddonDetailDialogProps) {
  const transitional = addon ? isTransitionalAddonStatus(addon.status) : false;
  // Only read while an addon is shown; the fallback just keeps the type simple.
  const action: AddonAction = addon ? addonAction(addon, stuck) : 'disable';
  const ActionIcon = ADDON_ACTION_UI[action].icon;
  const uiProblem = dashboardUiProblem(uiEntry);
  const failedServices = addon?.status_details?.failed_services ?? [];
  const statusMessage = addon?.status_details?.message;

  return (
    <Dialog open={addon !== undefined} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="flex max-h-[85vh] flex-col sm:max-w-xl"
        data-testid="addon-detail"
        // Radix would focus the first button, a copy button that then opens with a focus ring.
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          (event.currentTarget as HTMLElement).focus();
        }}
      >
        {addon ? (
          <>
            <DialogHeader>
              <AddonHeading addon={addon} title={DialogTitle}>
                <span className="text-muted-foreground text-sm font-normal tabular-nums">
                  v{addon.version}
                </span>
                <AddonStatusBadge status={addon.status} />
              </AddonHeading>
              <DialogDescription>{addon.description || 'No description.'}</DialogDescription>
            </DialogHeader>
            <ScrollArea className="-mx-2 min-h-0 flex-1 px-2">
              <div className="space-y-4">
                <dl className="grid grid-cols-[7rem_1fr] items-center gap-x-6 gap-y-1.5 text-sm">
                  <dt className="text-muted-foreground">Version</dt>
                  <dd className="flex flex-wrap items-center gap-2 tabular-nums">
                    {addon.version}
                    {addon.update_available && addon.latest_version ? (
                      <span className="text-muted-foreground" data-testid="update-available">
                        {addon.latest_version} available
                      </span>
                    ) : null}
                  </dd>
                  <dt className="text-muted-foreground">Source</dt>
                  <dd>
                    <SourceLabel source={addon.source} />
                  </dd>
                  <AddonClassificationRows category={addon.category} tags={addon.tags} />
                  <dt className="text-muted-foreground">Services</dt>
                  <dd className="tabular-nums">{addon.services.length}</dd>
                  <dt className="text-muted-foreground">Dashboard UI</dt>
                  <dd>
                    <DashboardUiBadge entry={uiEntry} />
                  </dd>
                  {navItemKeys(uiEntry).length > 0 ? (
                    <>
                      <dt className="text-muted-foreground self-start">Nav item keys</dt>
                      <dd className="min-w-0">
                        <NavItemKeys entry={uiEntry} />
                      </dd>
                    </>
                  ) : null}
                  <dt className="text-muted-foreground">Addon id</dt>
                  <dd className="flex min-w-0 items-center gap-1">
                    <code className="truncate font-mono text-xs">{addon.addon_id}</code>
                    <CopyButton value={addon.addon_id} label="Copy addon id" />
                  </dd>
                </dl>

                {failedServices.length > 0 || statusMessage || uiProblem || addon.logs ? (
                  <section className="space-y-3 border-t pt-4" aria-label="Problems">
                    {statusMessage ? (
                      <Alert
                        variant={addon.status === 'failed' ? 'destructive' : 'warning'}
                        data-testid="status-message"
                      >
                        <AlertTitle>
                          {addon.status === 'failed' ? 'Why it failed' : 'Status'}
                        </AlertTitle>
                        <AlertDescription className="break-words">{statusMessage}</AlertDescription>
                      </Alert>
                    ) : null}
                    {failedServices.length > 0 ? (
                      <Alert
                        variant={addon.status === 'failed' ? 'destructive' : 'warning'}
                        data-testid="failed-services"
                      >
                        <AlertTitle>Failed services</AlertTitle>
                        <AlertDescription>
                          <ul className="list-inside list-disc">
                            {failedServices.map((name) => (
                              <li key={name}>{name}</li>
                            ))}
                          </ul>
                        </AlertDescription>
                      </Alert>
                    ) : null}

                    {uiProblem ? (
                      <p className="text-destructive text-sm break-words">
                        Dashboard UI: {uiProblem}
                      </p>
                    ) : null}

                    {addon.logs ? (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <h3 className="text-sm font-semibold">Logs</h3>
                          <CopyButton value={addon.logs} label="Copy logs" />
                        </div>
                        {/* Focusable so keyboard users can scroll long logs. */}
                        <pre
                          className="bg-muted max-h-80 overflow-auto rounded-md p-3 font-mono text-xs whitespace-pre-wrap break-words"
                          // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
                          tabIndex={0}
                          aria-label="Addon logs"
                          data-testid="addon-logs"
                        >
                          {addon.logs}
                        </pre>
                      </div>
                    ) : null}
                  </section>
                ) : null}

                <Separator />
                <section className="space-y-2" aria-label="Granted permissions">
                  <h3 className="text-sm font-semibold">Granted permissions</h3>
                  <PermissionList permissions={addon.permissions} />
                </section>
                <DefinitionDetails
                  services={addon.services}
                  volumes={addon.volumes}
                  networks={addon.networks}
                  failingServices={failedServices}
                />
              </div>
            </ScrollArea>
            <DialogFooter className="sm:justify-between">
              <Button
                variant="ghost"
                className="text-destructive hover:text-destructive"
                // A plain disable waits for the running change; a stuck one may force it.
                disabled={action === 'disable' && transitional}
                onClick={() => onAction(action, addon)}
              >
                <ActionIcon aria-hidden data-icon="inline-start" />
                {ADDON_ACTION_UI[action].buttonLabel}
              </Button>
              <div className="flex flex-col-reverse gap-2 sm:flex-row">
                <Button variant="outline" onClick={onClose}>
                  Close
                </Button>
                {canApprove(addon) ? (
                  <Button disabled={busy} onClick={() => onApprove(addon)}>
                    <PendingIcon pending={working === 'approve'} icon={ShieldCheckIcon} />
                    Approve again
                  </Button>
                ) : null}
                {canUpdate(addon) ? (
                  <Button disabled={busy} onClick={() => onUpdate(addon)}>
                    <PendingIcon pending={working === 'update'} icon={ArrowUpCircleIcon} />
                    Update to {addon.latest_version}
                  </Button>
                ) : null}
              </div>
            </DialogFooter>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

/** A button's icon, swapped for a spinner while its call is in flight. */
function PendingIcon({ pending, icon: Icon }: { pending: boolean; icon: LucideIcon }) {
  return pending ? (
    <LoaderCircleIcon className="animate-spin" aria-hidden data-icon="inline-start" />
  ) : (
    <Icon aria-hidden data-icon="inline-start" />
  );
}
