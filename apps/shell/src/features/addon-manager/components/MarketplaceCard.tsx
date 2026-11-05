import {
  isTransitionalAddonStatus,
  type InstalledAddon,
  type MarketplaceAddon,
} from '@oakestra/api';
import {
  Badge,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  plural,
} from '@oakestra/ui';
import { LoaderCircleIcon, MoreHorizontalIcon, Trash2Icon } from 'lucide-react';
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
    <div
      data-testid={`marketplace-card-${addon.name}`}
      className="flex w-full min-w-0 flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3"
    >
      <div className="min-w-0 flex-1 basis-64 space-y-0.5">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-sm font-medium break-all">{addon.name}</span>
          {addon.ui ? <Badge variant="secondary">Dashboard UI</Badge> : null}
          {installed ? <AddonStatusBadge status={installed.status} /> : null}
          <span className="text-muted-foreground text-xs tabular-nums">
            {plural(addon.services.length, 'service')}
          </span>
        </div>
        <p className="text-muted-foreground truncate text-sm" title={addon.description}>
          {addon.description || 'No description.'}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <Button
          size="sm"
          variant="ghost"
          onClick={onDetails}
          aria-label={`Details of ${addon.name}`}
        >
          Details
        </Button>
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
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="icon-sm" variant="ghost" aria-label={`More actions for ${addon.name}`}>
              <MoreHorizontalIcon aria-hidden />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem variant="destructive" onSelect={onDelete}>
              <Trash2Icon aria-hidden />
              Delete from marketplace
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
