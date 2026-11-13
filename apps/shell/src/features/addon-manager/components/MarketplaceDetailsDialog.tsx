import {
  isTransitionalAddonStatus,
  type InstalledAddon,
  type MarketplaceAddon,
} from '@oakestra/api';
import {
  Alert,
  AlertDescription,
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  ScrollArea,
} from '@oakestra/ui';
import { DownloadIcon, SettingsIcon } from 'lucide-react';
import { Link } from 'react-router';

import { isHttpUrl } from '../../../core/addons/ui-addons';
import { installedAddonLink } from '../paths';
import { uiIncompatibility } from '../ui-compat';
import { AddonClassificationRows, AddonHeading } from './AddonHeading';
import { DefinitionDetails } from './DefinitionDetails';
import { PermissionList } from './PermissionList';
import { SourceLabel } from './SourceLabel';

interface MarketplaceDetailsDialogProps {
  addon: MarketplaceAddon | null;
  onClose: () => void;
  installed: InstalledAddon | undefined;
  canInstall: boolean;
  onInstall: (addon: MarketplaceAddon) => void;
}

/** Plain http(s) links only: the homepage comes from a third-party index. */
function safeHref(url: string | undefined): string | undefined {
  return url && isHttpUrl(url) ? url : undefined;
}

export function MarketplaceDetailsDialog({
  addon,
  onClose,
  installed,
  canInstall,
  onInstall,
}: MarketplaceDetailsDialogProps) {
  const incompatible = addon ? uiIncompatibility(addon.ui) : null;
  const homepage = safeHref(addon?.homepage);
  // Same rules as the card: a disabled record does not block a new install, and nothing can be
  // installed while the previous record is still changing.
  const manageable = installed?.status === 'disabled' ? undefined : installed;
  const busy = installed !== undefined && isTransitionalAddonStatus(installed.status);
  return (
    <Dialog open={addon !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex max-h-[85vh] flex-col sm:max-w-xl">
        {addon ? (
          <>
            <DialogHeader>
              <AddonHeading addon={addon} title={DialogTitle}>
                <span className="text-muted-foreground text-sm font-normal tabular-nums">
                  v{addon.version}
                </span>
                {addon.ui ? <Badge variant="secondary">Dashboard UI</Badge> : null}
              </AddonHeading>
              <DialogDescription>{addon.description || 'No description.'}</DialogDescription>
            </DialogHeader>
            <ScrollArea className="-mx-2 min-h-0 flex-1 px-2">
              <div className="space-y-4">
                <dl className="grid grid-cols-[7rem_1fr] items-center gap-x-6 gap-y-1.5 text-sm">
                  <dt className="text-muted-foreground">Source</dt>
                  <dd>
                    <SourceLabel source={addon.source} />
                  </dd>
                  {homepage ? (
                    <>
                      <dt className="text-muted-foreground">Homepage</dt>
                      <dd className="min-w-0 truncate">
                        <a
                          href={homepage}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="underline-offset-4 hover:underline"
                        >
                          {homepage}
                        </a>
                      </dd>
                    </>
                  ) : null}
                  <AddonClassificationRows category={addon.category} tags={addon.tags} />
                  {addon.maintainers.length > 0 ? (
                    <>
                      <dt className="text-muted-foreground">Maintainers</dt>
                      <dd>{addon.maintainers.join(', ')}</dd>
                    </>
                  ) : null}
                </dl>

                {addon.ui ? (
                  <p className="text-muted-foreground text-sm">
                    The dashboard UI is served by <code>{addon.ui.service}</code> and built for SDK{' '}
                    <code>{addon.ui.sdk}</code>.
                  </p>
                ) : null}
                {incompatible ? (
                  <Alert variant="warning" data-testid="ui-incompatible">
                    <AlertDescription>
                      {incompatible}. Its UI would not load in this dashboard, so it cannot be
                      installed from here.
                    </AlertDescription>
                  </Alert>
                ) : null}

                <section className="space-y-2" aria-label="Permissions">
                  <h3 className="text-sm font-semibold">Permissions</h3>
                  <PermissionList permissions={addon.permissions} />
                </section>

                <DefinitionDetails
                  services={addon.services}
                  volumes={addon.volumes}
                  networks={addon.networks}
                />
              </div>
            </ScrollArea>
            <DialogFooter>
              <Button variant="outline" onClick={onClose}>
                Close
              </Button>
              {manageable ? (
                <Button asChild>
                  <Link to={installedAddonLink(manageable._id)}>
                    <SettingsIcon aria-hidden />
                    Manage
                  </Link>
                </Button>
              ) : (
                <Button
                  disabled={busy || !canInstall || incompatible !== null}
                  onClick={() => {
                    onClose();
                    onInstall(addon);
                  }}
                >
                  <DownloadIcon aria-hidden />
                  Install
                </Button>
              )}
            </DialogFooter>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
