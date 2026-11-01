import type { MarketplaceAddon } from '@oakestra/api';
import {
  Badge,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  ScrollArea,
} from '@oakestra/ui';

import { DefinitionDetails } from './DefinitionDetails';

interface MarketplaceDetailsDialogProps {
  addon: MarketplaceAddon | null;
  onClose: () => void;
}

export function MarketplaceDetailsDialog({ addon, onClose }: MarketplaceDetailsDialogProps) {
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
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
