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
  CopyButton,
} from '@oakestra/ui';
import { PowerOffIcon, Trash2Icon } from 'lucide-react';

import type { AddonEntry } from '../../../core/addons/addon-registry';
import { addonAction, type AddonAction } from '../addon-action';
import { AddonStatusBadge } from './AddonStatusBadge';
import { DashboardUiBadge, dashboardUiProblem } from './DashboardUiBadge';
import { DefinitionDetails } from './DefinitionDetails';
import { navItemKeys, NavItemKeys } from './NavItemKeys';

interface AddonDetailSheetProps {
  addon: InstalledAddon | undefined;
  uiEntry: AddonEntry | undefined;
  onClose: () => void;
  /** Installing for so long that it is probably stuck. */
  stuck: boolean;
  onAction: (action: AddonAction, addon: InstalledAddon) => void;
}

export function AddonDetailSheet({
  addon,
  uiEntry,
  onClose,
  stuck,
  onAction,
}: AddonDetailSheetProps) {
  const transitional = addon ? isTransitionalAddonStatus(addon.status) : false;
  const action = addon ? addonAction(addon, stuck) : undefined;
  const uiProblem = dashboardUiProblem(uiEntry);
  const failedServices = addon?.status_details?.failed_services ?? [];

  return (
    <Sheet open={addon !== undefined} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full gap-0 sm:max-w-xl" data-testid="addon-detail">
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
              <div className="space-y-6 px-4 pb-4">
                <dl className="grid grid-cols-[7rem_1fr] items-center gap-x-2 gap-y-2 text-sm">
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
                  <dt className="text-muted-foreground">Marketplace id</dt>
                  <dd className="flex min-w-0 items-center gap-1">
                    <code className="truncate font-mono text-xs">{addon.marketplace_id}</code>
                    <CopyButton value={addon.marketplace_id} label="Copy marketplace id" />
                  </dd>
                </dl>

                {failedServices.length > 0 || uiProblem || addon.logs ? (
                  <section className="space-y-3" aria-label="Problems">
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
                          className="bg-muted max-h-80 overflow-auto rounded-lg p-3 font-mono text-xs whitespace-pre-wrap break-words"
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
                <DefinitionDetails
                  services={addon.services}
                  volumes={addon.volumes}
                  networks={addon.networks}
                  failingServices={failedServices}
                />
              </div>
            </ScrollArea>
            <SheetFooter className="border-t sm:flex-row sm:justify-end">
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
