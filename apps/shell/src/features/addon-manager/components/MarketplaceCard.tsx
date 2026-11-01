import {
  isTransitionalAddonStatus,
  type InstalledAddon,
  type MarketplaceAddon,
} from '@oakestra/api';
import {
  Badge,
  Button,
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@oakestra/ui';
import {
  DownloadIcon,
  InfoIcon,
  LoaderCircleIcon,
  MoreHorizontalIcon,
  PuzzleIcon,
  SettingsIcon,
  Trash2Icon,
} from 'lucide-react';
import { Link } from 'react-router';

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

export function installedAddonLink(installed: InstalledAddon): string {
  return `/addon-manager/installed?addon=${encodeURIComponent(installed._id)}`;
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
    <Card data-testid={`marketplace-card-${addon.name}`} className="w-full min-w-0">
      <CardHeader>
        <div className="flex items-start gap-3">
          <div
            aria-hidden
            className="bg-muted text-muted-foreground flex size-8 shrink-0 items-center justify-center rounded-lg"
          >
            <PuzzleIcon className="size-4" />
          </div>
          <div className="min-w-0 flex-1 space-y-1">
            <CardTitle className="flex flex-wrap items-center gap-2 break-all">
              {addon.name}
              {addon.ui ? <Badge variant="secondary">Dashboard UI</Badge> : null}
            </CardTitle>
            <p className="text-muted-foreground flex flex-wrap items-center gap-2 text-xs tabular-nums">
              {addon.services.length} {addon.services.length === 1 ? 'service' : 'services'}
              {installed ? <AddonStatusBadge status={installed.status} /> : null}
            </p>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="icon-sm"
                variant="ghost"
                className="-mt-1 -mr-2"
                aria-label={`More actions for ${addon.name}`}
              >
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
        <CardDescription className="line-clamp-3">
          {addon.description || 'No description.'}
        </CardDescription>
      </CardHeader>
      <CardFooter className="mt-auto flex-wrap gap-2 pt-2">
        {installed ? (
          <Button size="sm" variant="outline" asChild>
            <Link to={installedAddonLink(installed)} aria-label={`Manage ${addon.name}`}>
              <SettingsIcon aria-hidden />
              Manage
            </Link>
          </Button>
        ) : (
          <Button
            size="sm"
            disabled={busy || !canInstall}
            onClick={onInstall}
            aria-label={`Install ${addon.name}`}
          >
            {installing ? (
              <LoaderCircleIcon className="animate-spin" aria-hidden />
            ) : (
              <DownloadIcon aria-hidden />
            )}
            {installing ? 'Installing' : 'Install'}
          </Button>
        )}
        <Button
          size="sm"
          variant="ghost"
          onClick={onDetails}
          aria-label={`Details of ${addon.name}`}
        >
          <InfoIcon aria-hidden />
          Details
        </Button>
      </CardFooter>
    </Card>
  );
}
