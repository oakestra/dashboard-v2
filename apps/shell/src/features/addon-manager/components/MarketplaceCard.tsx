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
  cn,
  stretchedLinkClassName,
} from '@oakestra/ui';
import { LoaderCircleIcon, Trash2Icon } from 'lucide-react';
import { Link } from 'react-router';

import { addonTitle } from '../display';
import { normalizeCategory, normalizeTag } from '../marketplace-filters';
import { installedAddonLink } from '../paths';
import { uiIncompatibility } from '../ui-compat';
import { QualifiedName } from './AddonHeading';
import { AddonIcon } from './AddonIcon';
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
  /** The category and tag filters in effect, already normalized, so their chips show as pressed. */
  activeCategory: string;
  activeTag: string;
  /** Toggles the category or tag filter, from the chips on the card. */
  onCategory: (category: string) => void;
  onTag: (tag: string) => void;
}

const chipClassName =
  'relative z-10 cursor-pointer rounded-sm px-1.5 py-0.5 text-xs transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:ring-ring/30 focus-visible:ring-2 focus-visible:outline-none aria-pressed:bg-accent aria-pressed:text-accent-foreground';

export function MarketplaceCard({
  addon,
  installed,
  installing,
  canInstall,
  onInstall,
  onDetails,
  onDelete,
  activeCategory,
  activeTag,
  onCategory,
  onTag,
}: MarketplaceCardProps) {
  const busy =
    installing || (installed !== undefined && isTransitionalAddonStatus(installed.status));
  // A disabled record doesn't block a new install on the backend, so the card offers Install
  // again instead of sending the admin to remove the old record first.
  const manageable = installed?.status === 'disabled' ? undefined : installed;
  const incompatible = uiIncompatibility(addon.ui);
  const title = addonTitle(addon);
  const category = addon.category ? normalizeCategory(addon.category) : '';

  return (
    <Card
      data-testid={`marketplace-card-${addon.qualified_name}`}
      className="hover:bg-accent/40 h-full gap-3 transition-colors"
    >
      <div className="flex items-start gap-3 px-5">
        <AddonIcon icon={addon.icon} />
        <div className="min-w-0 flex-1">
          <button
            type="button"
            aria-label={`Details of ${addon.qualified_name}`}
            className={`block max-w-full cursor-pointer truncate font-semibold ${stretchedLinkClassName}`}
            onClick={onDetails}
          >
            {title}
          </button>
          <QualifiedName addon={addon} />
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
      <p className="text-muted-foreground line-clamp-2 px-5 text-sm">
        {addon.description || 'No description'}
      </p>
      {category || addon.tags.length > 0 ? (
        <div className="text-muted-foreground -mx-1.5 flex flex-wrap items-center gap-0.5 px-5">
          {category ? (
            <button
              type="button"
              className={cn(chipClassName, 'font-medium')}
              aria-pressed={activeCategory === category}
              aria-label={`Filter by category ${category}`}
              onClick={() => onCategory(category)}
            >
              {category}
            </button>
          ) : null}
          {addon.tags.map((tag) => (
            <button
              key={tag}
              type="button"
              className={chipClassName}
              aria-pressed={activeTag !== '' && activeTag === normalizeTag(tag)}
              aria-label={`Filter by tag ${tag}`}
              onClick={() => onTag(tag)}
            >
              #{tag}
            </button>
          ))}
        </div>
      ) : null}
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
