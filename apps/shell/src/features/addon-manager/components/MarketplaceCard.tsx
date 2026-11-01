import {
  isTransitionalAddonStatus,
  type InstalledAddon,
  type MarketplaceAddon,
} from '@oakestra/api';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@oakestra/ui';
import { DownloadIcon, InfoIcon, LoaderCircleIcon, Trash2Icon } from 'lucide-react';
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
  const images = [...new Set(addon.services.map((service) => service.image))];

  return (
    <Card data-testid={`marketplace-card-${addon.name}`} className="w-full min-w-0">
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2">
          {addon.name}
          {addon.ui ? <Badge variant="secondary">Dashboard UI</Badge> : null}
        </CardTitle>
        <CardDescription className="line-clamp-3">
          {addon.description || 'No description.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-1 space-y-3">
        <ul className="space-y-1">
          {images.slice(0, 3).map((image) => (
            <li
              key={image}
              className="text-muted-foreground truncate font-mono text-xs"
              title={image}
            >
              {image}
            </li>
          ))}
          {images.length > 3 ? (
            <li className="text-muted-foreground text-xs">and {images.length - 3} more</li>
          ) : null}
        </ul>
        {installed ? (
          <Link
            to={`/addon-manager/installed?addon=${encodeURIComponent(installed._id)}`}
            className="inline-flex items-center gap-2 text-sm"
            aria-label={`${addon.name} is installed, show it`}
          >
            <span className="text-muted-foreground">Installed:</span>
            <AddonStatusBadge status={installed.status} />
          </Link>
        ) : null}
      </CardContent>
      <CardFooter className="flex-wrap gap-2">
        <Button
          size="sm"
          disabled={installed !== undefined || busy || !canInstall}
          onClick={onInstall}
          aria-label={`Install ${addon.name}`}
        >
          {installing ? (
            <LoaderCircleIcon className="animate-spin" aria-hidden />
          ) : (
            <DownloadIcon aria-hidden />
          )}
          {installing ? 'Installing' : installed ? 'Installed' : 'Install'}
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={onDetails}
          aria-label={`Details of ${addon.name}`}
        >
          <InfoIcon aria-hidden />
          Details
        </Button>
        <Button
          size="icon-sm"
          variant="ghost"
          className="ml-auto"
          onClick={onDelete}
          aria-label={`Delete ${addon.name} from the marketplace`}
        >
          <Trash2Icon aria-hidden />
        </Button>
      </CardFooter>
    </Card>
  );
}
