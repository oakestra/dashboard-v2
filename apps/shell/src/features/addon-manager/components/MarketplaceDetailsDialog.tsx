import type { InstalledAddon, MarketplaceAddon } from '@oakestra/api';
import {
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

import { installedAddonLink } from '../paths';
import { DefinitionDetails } from './DefinitionDetails';

interface MarketplaceDetailsDialogProps {
  addon: MarketplaceAddon | null;
  onClose: () => void;
  installed: InstalledAddon | undefined;
  canInstall: boolean;
  onInstall: (addon: MarketplaceAddon) => void;
}

export function MarketplaceDetailsDialog({
  addon,
  onClose,
  installed,
  canInstall,
  onInstall,
}: MarketplaceDetailsDialogProps) {
  return (
    <Dialog open={addon !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex max-h-[85vh] flex-col sm:max-w-xl">
        {addon ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex flex-wrap items-center gap-2">
                {addon.name}
                {addon.ui ? <Badge variant="secondary">Dashboard UI</Badge> : null}
              </DialogTitle>
              <DialogDescription>{addon.description || 'No description.'}</DialogDescription>
            </DialogHeader>
            <ScrollArea className="-mx-2 min-h-0 flex-1 px-2">
              {addon.ui ? (
                <p className="text-muted-foreground mb-4 text-sm">
                  The dashboard UI is served by <code>{addon.ui.service}</code> and built for SDK{' '}
                  <code>{addon.ui.sdk}</code>.
                </p>
              ) : null}
              <DefinitionDetails
                services={addon.services}
                volumes={addon.volumes}
                networks={addon.networks}
              />
            </ScrollArea>
            <DialogFooter>
              <Button variant="outline" onClick={onClose}>
                Close
              </Button>
              {installed ? (
                <Button asChild>
                  <Link to={installedAddonLink(installed._id)}>
                    <SettingsIcon aria-hidden />
                    Manage
                  </Link>
                </Button>
              ) : (
                <Button
                  disabled={!canInstall}
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
