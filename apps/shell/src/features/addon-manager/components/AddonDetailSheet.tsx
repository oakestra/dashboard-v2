import type { InstalledAddon } from '@oakestra/api';
import { isTransitionalAddonStatus } from '@oakestra/api';
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Button,
  ScrollArea,
  Separator,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SourceTag,
  CopyButton,
} from '@oakestra/ui';
import { ArrowUpCircleIcon, PowerOffIcon, ShieldCheckIcon, Trash2Icon } from 'lucide-react';

import type { AddonEntry } from '../../../core/addons/addon-registry';
import { addonAction, canApprove, canUpdate, type AddonAction } from '../addon-action';
import { AddonStatusBadge } from './AddonStatusBadge';
import { DashboardUiBadge, dashboardUiProblem } from './DashboardUiBadge';
import { DefinitionDetails } from './DefinitionDetails';
import { navItemKeys, NavItemKeys } from './NavItemKeys';
import { PermissionList } from './PermissionList';

interface AddonDetailSheetProps {
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
}

export function AddonDetailSheet({
  addon,
  uiEntry,
  onClose,
  stuck,
  onAction,
  onUpdate,
  onApprove,
  busy,
}: AddonDetailSheetProps) {
  const transitional = addon ? isTransitionalAddonStatus(addon.status) : false;
  const action = addon ? addonAction(addon, stuck) : undefined;
  const uiProblem = dashboardUiProblem(uiEntry);
  const failedServices = addon?.status_details?.failed_services ?? [];
  const statusMessage = addon?.status_details?.message;

  return (
    <Sheet open={addon !== undefined} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        className="w-full gap-0 sm:max-w-xl"
        data-testid="addon-detail"
        // Radix would focus the first button, a copy button that then opens with a focus ring.
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          (event.currentTarget as HTMLElement).focus();
        }}
      >
        {addon ? (
          <>
            <SheetHeader className="pr-12">
              <SheetTitle className="flex flex-wrap items-center gap-2">
                {addon.name}
                <AddonStatusBadge status={addon.status} />
              </SheetTitle>
              <SheetDescription>{addon.description || 'No description.'}</SheetDescription>
            </SheetHeader>
            <ScrollArea className="min-h-0 flex-1">
              <div className="space-y-4 px-4 pb-4">
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
                  <dd className="flex items-center gap-2">
                    <SourceTag name={addon.source.name} />
                    <span className="text-muted-foreground">{addon.source.kind}</span>
                  </dd>
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
            <SheetFooter className="border-t sm:flex-row sm:justify-end">
              {canApprove(addon) ? (
                <Button variant="outline" disabled={busy} onClick={() => onApprove(addon)}>
                  <ShieldCheckIcon aria-hidden />
                  Approve again
                </Button>
              ) : null}
              {canUpdate(addon) ? (
                <Button variant="outline" disabled={busy} onClick={() => onUpdate(addon)}>
                  <ArrowUpCircleIcon aria-hidden />
                  Update to {addon.latest_version}
                </Button>
              ) : null}
              {action === 'remove' ? (
                <Button variant="destructive" onClick={() => onAction(action, addon)}>
                  <Trash2Icon aria-hidden />
                  Remove addon
                </Button>
              ) : action === 'force-disable' ? (
                <Button variant="outline" onClick={() => onAction(action, addon)}>
                  <PowerOffIcon aria-hidden />
                  Disable anyway
                </Button>
              ) : (
                <Button
                  variant="outline"
                  disabled={transitional}
                  onClick={() => onAction('disable', addon)}
                >
                  <PowerOffIcon aria-hidden />
                  Disable addon
                </Button>
              )}
            </SheetFooter>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
