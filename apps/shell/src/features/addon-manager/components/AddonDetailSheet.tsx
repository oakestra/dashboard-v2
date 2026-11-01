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
} from '@oakestra/ui';
import { PowerOffIcon, Trash2Icon } from 'lucide-react';

import type { AddonEntry } from '../../../core/addons/addon-registry';
import { CopyButton } from '../../../components/CopyButton';
import { AddonStatusBadge } from './AddonStatusBadge';
import { DashboardUiBadge, dashboardUiProblem } from './DashboardUiBadge';
import { DefinitionDetails } from './DefinitionDetails';

interface AddonDetailSheetProps {
  addon: InstalledAddon | undefined;
  uiEntry: AddonEntry | undefined;
  onClose: () => void;
  /** Installing for so long that it is probably stuck. */
  stuck: boolean;
  onDisable: (addon: InstalledAddon) => void;
  onForceDisable: (addon: InstalledAddon) => void;
  onRemove: (addon: InstalledAddon) => void;
}

export function AddonDetailSheet({
  addon,
  uiEntry,
  onClose,
  stuck,
  onDisable,
  onForceDisable,
  onRemove,
}: AddonDetailSheetProps) {
  const transitional = addon ? isTransitionalAddonStatus(addon.status) : false;
  const uiProblem = dashboardUiProblem(uiEntry);

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
                {addon.status_details && addon.status_details.failed_services.length > 0 ? (
                  <Alert variant="destructive" data-testid="failed-services">
                    <AlertTitle>Failed services</AlertTitle>
                    <AlertDescription>
                      <ul className="list-inside list-disc">
                        {addon.status_details.failed_services.map((name) => (
                          <li key={name}>{name}</li>
                        ))}
                      </ul>
                    </AlertDescription>
                  </Alert>
                ) : null}

                <section className="space-y-2">
                  <h3 className="text-sm font-semibold">Dashboard UI</h3>
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <DashboardUiBadge entry={uiEntry} />
                    {!uiEntry ? (
                      <span className="text-muted-foreground">This addon has no dashboard UI.</span>
                    ) : null}
                  </div>
                  {uiProblem ? (
                    <p className="text-destructive text-sm break-words">{uiProblem}</p>
                  ) : null}
                </section>

                {addon.logs ? (
                  <section className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold">Logs</h3>
                      <CopyButton value={addon.logs} label="Copy logs" />
                    </div>
                    {/* Focusable so keyboard users can scroll long logs. */}
                    <pre
                      className="bg-muted max-h-60 overflow-auto rounded-lg p-3 font-mono text-xs whitespace-pre-wrap break-words"
                      // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
                      tabIndex={0}
                      aria-label="Addon logs"
                      data-testid="addon-logs"
                    >
                      {addon.logs}
                    </pre>
                  </section>
                ) : null}

                <Separator />
                <DefinitionDetails
                  services={addon.services}
                  volumes={addon.volumes}
                  networks={addon.networks}
                />
              </div>
            </ScrollArea>
            <SheetFooter className="border-t sm:flex-row sm:justify-end">
              {addon.status === 'disabled' ? (
                <Button variant="destructive" onClick={() => onRemove(addon)}>
                  <Trash2Icon aria-hidden />
                  Remove
                </Button>
              ) : stuck && addon.status === 'installing' ? (
                <Button variant="outline" onClick={() => onForceDisable(addon)}>
                  <PowerOffIcon aria-hidden />
                  Disable anyway
                </Button>
              ) : (
                <Button variant="outline" disabled={transitional} onClick={() => onDisable(addon)}>
                  <PowerOffIcon aria-hidden />
                  Disable
                </Button>
              )}
            </SheetFooter>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
