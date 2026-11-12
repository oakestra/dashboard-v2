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
  RowMenu,
  SourceTag,
  StatusBadge,
  plural,
  stretchedLinkClassName,
} from '@oakestra/ui';
import { LoaderCircleIcon, Trash2Icon } from 'lucide-react';
import { Link } from 'react-router';

import { installedAddonLink } from '../paths';
import { uiIncompatibility } from '../ui-compat';
import { AddonStatusBadge } from './AddonStatusBadge';
import { PermissionBadges } from './PermissionList';

interface MarketplaceCardProps {
  addon: MarketplaceAddon;
  /** The current installed record of this addon, if any. */
  installed: InstalledAddon | undefined;
  installing: boolean;
  /** Installing is off while the installed list is unknown, or a double install would slip by. */
  canInstall: boolean;
  onInstall: () => void;
  onDetails: () => void;
  /** Only local registrations can be deleted from the dashboard. */
  onDelete?: () => void;
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
  // A disabled record doesn't block a new install on the backend, so the card offers Install
  // again instead of sending the admin to remove the old record first.
  const manageable = installed?.status === 'disabled' ? undefined : installed;
  const incompatible = uiIncompatibility(addon.ui);

  return (
    <Card
      data-testid={`marketplace-card-${addon.qualified_name}`}
      className="hover:bg-accent/40 h-full gap-3 transition-colors"
    >
      <div className="flex items-start justify-between gap-3 px-5">
        <div className="min-w-0">
          <button
            type="button"
            aria-label={`Details of ${addon.qualified_name}`}
            className={`block max-w-full cursor-pointer truncate font-semibold ${stretchedLinkClassName}`}
            onClick={onDetails}
          >
            {addon.qualified_name}
          </button>
          <div className="text-muted-foreground flex flex-wrap items-center gap-x-2 text-xs tabular-nums">
            <span>v{addon.version}</span>
            <span aria-hidden>·</span>
            <span>{plural(addon.services.length, 'service')}</span>
            <SourceTag name={addon.source.name} title={`Source: ${addon.source.kind}`} />
          </div>
        </div>
        {onDelete ? (
          <div className="relative z-10 -mt-1 -mr-2">
            <RowMenu label={`More actions for ${addon.qualified_name}`}>
              <DropdownMenuItem variant="destructive" onSelect={onDelete}>
                <Trash2Icon aria-hidden />
                Delete from marketplace
              </DropdownMenuItem>
            </RowMenu>
          </div>
        ) : null}
      </div>
      <p className="text-muted-foreground line-clamp-2 min-h-10 px-5 text-sm">
        {addon.description || 'No description'}
      </p>
      <div className="px-5">
        <PermissionBadges permissions={addon.permissions} />
      </div>
      <div className="mt-auto flex items-center justify-between gap-3 px-5">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          {installed ? <AddonStatusBadge status={installed.status} /> : null}
          {installed?.update_available ? <Badge variant="secondary">Update available</Badge> : null}
          {addon.ui ? (
            incompatible ? (
              <StatusBadge tone="warning" title={incompatible}>
                UI incompatible
              </StatusBadge>
            ) : (
              <Badge variant="secondary">Dashboard UI</Badge>
            )
          ) : null}
        </div>
        <div className="relative z-10 shrink-0">
          {manageable ? (
            <Button size="sm" variant="outline" asChild>
              <Link
                to={installedAddonLink(manageable._id)}
                aria-label={`Manage ${addon.qualified_name}`}
              >
                Manage
              </Link>
            </Button>
          ) : (
            <Button
              size="sm"
              variant="outline"
              disabled={busy || !canInstall || incompatible !== null}
              title={incompatible ?? undefined}
              onClick={onInstall}
              aria-label={`Install ${addon.qualified_name}`}
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
