import {
  isTransitionalAddonStatus,
  type InstalledAddon,
  type MarketplaceAddon,
} from '@oakestra/api';
import {
  Badge,
  Button,
  Card,
  DropdownMenuItem,
  plural,
  stretchedLinkClassName,
  RowMenu,
} from '@oakestra/ui';
import { LoaderCircleIcon, Trash2Icon } from 'lucide-react';
import { Link } from 'react-router';

import { installedAddonLink } from '../paths';
import { AddonStatusBadge } from './AddonStatusBadge';

interface MarketplaceCardProps {
  addon: MarketplaceAddon;
  /** The installed record of this definition, if any. */
  installed: InstalledAddon | undefined;
  installing: boolean;
  /** Installing is off while the installed list is unknown, or a double install would slip by. */
  canInstall: boolean;
  onInstall: () => void;
  onDetails: () => void;
  onDelete: () => void;
}

export function MarketplaceCard({
  addon,
  installed,
  installing,
  canInstall,
  onInstall,
  onDetails,
  onDelete,
}: MarketplaceCardProps) {
  const busy =
    installing || (installed !== undefined && isTransitionalAddonStatus(installed.status));

  return (
    <Card
      data-testid={`marketplace-card-${addon.name}`}
      className="hover:bg-accent/40 h-full gap-3 transition-colors"
    >
      <div className="flex items-start justify-between gap-3 px-5">
        <div className="min-w-0">
          <button
            type="button"
            aria-label={`Details of ${addon.name}`}
            className={`block max-w-full cursor-pointer truncate font-semibold ${stretchedLinkClassName}`}
            onClick={onDetails}
          >
            {addon.name}
          </button>
          <div className="text-muted-foreground text-xs tabular-nums">
            {plural(addon.services.length, 'service')}
          </div>
        </div>
        <div className="relative z-10 -mt-1 -mr-2">
          <RowMenu label={`More actions for ${addon.name}`}>
            <DropdownMenuItem variant="destructive" onSelect={onDelete}>
              <Trash2Icon aria-hidden />
              Delete from marketplace
            </DropdownMenuItem>
          </RowMenu>
        </div>
      </div>
      <p className="text-muted-foreground line-clamp-2 min-h-10 px-5 text-sm">
        {addon.description || 'No description'}
      </p>
      <div className="mt-auto flex items-center justify-between gap-3 px-5">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          {installed ? <AddonStatusBadge status={installed.status} /> : null}
          {addon.ui ? <Badge variant="secondary">Dashboard UI</Badge> : null}
        </div>
        <div className="relative z-10 shrink-0">
          {installed ? (
            <Button size="sm" variant="outline" asChild>
              <Link to={installedAddonLink(installed._id)} aria-label={`Manage ${addon.name}`}>
                Manage
              </Link>
            </Button>
          ) : (
            <Button
              size="sm"
              variant="outline"
              disabled={busy || !canInstall}
              onClick={onInstall}
              aria-label={`Install ${addon.name}`}
            >
              {installing ? <LoaderCircleIcon className="animate-spin" aria-hidden /> : null}
              {installing ? 'Installing' : 'Install'}
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}
