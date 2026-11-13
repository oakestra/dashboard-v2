import {
  isTransitionalAddonStatus,
  type InstalledAddon,
  type MarketplaceAddon,
} from '@oakestra/api';
import {
  Badge,
  Button,
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  DropdownMenuItem,
  DropdownMenuSeparator,
  RowMenu,
  SourceTag,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  cn,
  plural,
  stretchedLinkClassName,
} from '@oakestra/ui';
import {
  ArrowRightIcon,
  ArrowUpCircleIcon,
  BoxesIcon,
  DownloadIcon,
  InfoIcon,
  PanelsTopLeftIcon,
  ShieldAlertIcon,
  ShieldIcon,
  Trash2Icon,
  TriangleAlertIcon,
  type LucideIcon,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';

import { addonTitle } from '../display';
import { categoryLabel, normalizeCategory, normalizeTag } from '../marketplace-filters';
import { installedAddonLink } from '../paths';
import { permissionEntries } from '../permissions';
import { uiIncompatibility } from '../ui-compat';
import { AddonIcon } from './AddonIcon';
import { QualifiedName } from './AddonHeading';
import { addonStatusLabel, addonStatusTone } from './AddonStatusBadge';
import { OfficialMark } from './OfficialMark';
import { StateButton, toneTextClassName } from './StateButton';

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
  activeCategories: readonly string[];
  activeTags: readonly string[];
  /** Toggles the category or tag filter, from the chips on the card. */
  onCategory: (category: string) => void;
  onTag: (tag: string) => void;
}

// The chips sit above the stretched details button, hence relative z-10. Badge only styles the
// hover of anchors, so buttons get it here.
const chipClassName =
  'relative z-10 cursor-pointer font-normal text-muted-foreground hover:bg-accent hover:text-accent-foreground aria-pressed:border-ring aria-pressed:bg-accent aria-pressed:text-accent-foreground';

/** Every action links to the installed tab, which owns the consent dialog for update and approve. */
function InstalledStateButton({
  addon,
  installed,
}: {
  addon: MarketplaceAddon;
  installed: InstalledAddon;
}) {
  const to = installedAddonLink(installed._id);
  if (isTransitionalAddonStatus(installed.status)) {
    return <StateButton tone="info" state={addonStatusLabel(installed.status)} pending />;
  }
  if (installed.status === 'active' && installed.update_available) {
    return (
      <StateButton
        tone="info"
        state={`${installed.latest_version ?? 'Update'} available`}
        stateIcon={ArrowUpCircleIcon}
        action={{
          label: 'Update',
          icon: ArrowUpCircleIcon,
          ariaLabel: `Update ${addon.qualified_name}`,
          to,
        }}
        hint={`Running ${installed.version}.`}
      />
    );
  }
  return (
    <StateButton
      tone={addonStatusTone(installed.status)}
      state={addonStatusLabel(installed.status)}
      action={{
        label: 'Manage',
        icon: ArrowRightIcon,
        ariaLabel: `Manage ${addon.qualified_name}`,
        to,
      }}
      hint={
        [
          installed.status_details?.message,
          // The problem takes the button, so the newer version is mentioned here.
          installed.update_available ? `${installed.latest_version} is available.` : null,
        ]
          .filter(Boolean)
          .join(' ') || undefined
      }
      data-testid={`card-state-${addon.qualified_name}`}
    />
  );
}

/** How many tags fit next to the category on the card's single tag line; the rest are counted. */
const VISIBLE_TAGS = 2;

/** An icon and a number; the wording is in the tooltip and a visually hidden label. */
function Fact({
  icon: Icon,
  value,
  label,
  tooltip,
  tone,
}: {
  icon: LucideIcon;
  value?: ReactNode;
  /** The fact in words; one entry per line, so each can be found on its own. */
  label: readonly string[];
  tooltip?: ReactNode;
  tone?: 'warning' | 'destructive';
}) {
  return (
    <li>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={cn(
              'relative z-10 inline-flex items-center gap-1 text-xs tabular-nums [&_svg]:size-3.5',
              toneTextClassName(tone),
            )}
          >
            <Icon aria-hidden />
            {value !== undefined ? <span aria-hidden>{value}</span> : null}
            {label.map((line) => (
              <span key={line} className="sr-only">
                {line}
              </span>
            ))}
          </span>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">
          {tooltip ??
            label.map((line) => (
              <span key={line} className="block">
                {line}
              </span>
            ))}
        </TooltipContent>
      </Tooltip>
    </li>
  );
}

/** Services, dashboard UI and permissions, always on one line in the footer. */
function CardFacts({
  addon,
  incompatible,
}: {
  addon: MarketplaceAddon;
  incompatible: string | null;
}) {
  const entries = permissionEntries(addon.permissions);
  const dangerous = entries.filter((entry) => entry.dangerous);
  const paths = addon.permissions.host_paths.length;
  const ports = addon.permissions.host_ports.length;
  const counted = [
    paths > 0 ? plural(paths, 'host path') : null,
    ports > 0 ? plural(ports, 'host port') : null,
  ].filter((line) => line !== null);
  return (
    <ul aria-label="Summary" className="flex min-w-0 items-center gap-3">
      <Fact
        icon={BoxesIcon}
        value={addon.services.length}
        label={[plural(addon.services.length, 'service')]}
      />
      {addon.ui ? (
        incompatible ? (
          <Fact
            icon={TriangleAlertIcon}
            tone="warning"
            label={['UI incompatible']}
            tooltip={
              <>
                <span className="block font-medium">UI incompatible</span>
                {incompatible}
              </>
            }
          />
        ) : (
          <Fact icon={PanelsTopLeftIcon} label={['Dashboard UI']} />
        )
      ) : null}
      {dangerous.length > 0 ? (
        <Fact
          icon={ShieldAlertIcon}
          tone="destructive"
          value={dangerous.length + counted.length}
          label={[...dangerous.map((entry) => entry.label), ...counted]}
          tooltip={
            <>
              <span className="block font-medium">Dangerous permissions</span>
              {dangerous.map((entry) => (
                <span key={entry.key} className="block">
                  {entry.label}
                </span>
              ))}
              {counted.map((line) => (
                <span key={line} className="block">
                  Also {line}
                </span>
              ))}
            </>
          }
        />
      ) : counted.length > 0 ? (
        <Fact icon={ShieldIcon} value={paths + ports} label={counted} />
      ) : null}
    </ul>
  );
}

export function MarketplaceCard({
  addon,
  installed,
  installing,
  canInstall,
  onInstall,
  onDetails,
  onDelete,
  activeCategories,
  activeTags,
  onCategory,
  onTag,
}: MarketplaceCardProps) {
  // A disabled record doesn't block a new install on the backend, so the card offers Install
  // again instead of sending the admin to remove the old record first.
  const disabledRecord = installed?.status === 'disabled';
  const manageable = disabledRecord ? undefined : installed;
  const incompatible = uiIncompatibility(addon.ui);
  const installDisabled = !canInstall || incompatible !== null;
  const title = addonTitle(addon);
  const category = addon.category ? normalizeCategory(addon.category) : '';

  return (
    <Card
      data-testid={`marketplace-card-${addon.qualified_name}`}
      className="hover:bg-accent/40 h-full gap-4 pt-5 pb-4 transition-colors"
    >
      <CardHeader className="flex items-start gap-3">
        <AddonIcon icon={addon.icon} name={title} />
        {/* Always two lines, so the descriptions of a row of cards start at the same height. */}
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <CardTitle className="flex min-w-0 items-baseline gap-2">
            <button
              type="button"
              aria-label={`Details of ${addon.qualified_name}`}
              className={cn('min-w-0 cursor-pointer truncate text-left', stretchedLinkClassName)}
              onClick={onDetails}
            >
              {title}
            </button>
            <OfficialMark source={addon.source} className="-ml-0.5" />
            <span className="text-muted-foreground shrink-0 text-xs font-normal tabular-nums">
              v{addon.version}
            </span>
          </CardTitle>
          <CardDescription className="flex min-w-0 items-center gap-2 text-xs">
            <QualifiedName addon={addon} className="min-w-0 text-xs" />
            <SourceTag
              name={addon.source.name}
              title={`Source: ${addon.source.kind}`}
              className="shrink-0"
            />
          </CardDescription>
        </div>
        <CardAction className="relative z-10 -mt-1 -mr-2">
          <RowMenu label={`More actions for ${addon.qualified_name}`}>
            <DropdownMenuItem onSelect={onDetails}>
              <InfoIcon aria-hidden />
              Details
            </DropdownMenuItem>
            {manageable ? (
              <DropdownMenuItem asChild>
                <Link to={installedAddonLink(manageable._id)}>
                  <ArrowRightIcon aria-hidden />
                  Manage installed addon
                </Link>
              </DropdownMenuItem>
            ) : null}
            {onDelete ? (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onSelect={onDelete}>
                  <Trash2Icon aria-hidden />
                  Delete from marketplace
                </DropdownMenuItem>
              </>
            ) : null}
          </RowMenu>
        </CardAction>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col gap-3">
        {/* Two lines reserved, for the same reason as the header. */}
        <p className="text-muted-foreground line-clamp-2 min-h-10 text-sm">
          {addon.description || 'No description'}
        </p>
        {/* One line, kept even when empty, so every card has the same rows. */}
        <div className="flex h-6 min-w-0 flex-nowrap items-center gap-1.5 overflow-hidden">
          {/* Filled, unlike the outlined tags: an addon has one category and many tags. */}
          {category ? (
            <Badge
              variant="secondary"
              className={cn(chipClassName, 'text-secondary-foreground font-medium')}
              asChild
            >
              <button
                type="button"
                aria-pressed={activeCategories.includes(category)}
                aria-label={`Filter by category ${category}`}
                onClick={() => onCategory(category)}
              >
                {categoryLabel(category)}
              </button>
            </Badge>
          ) : null}
          {addon.tags.slice(0, VISIBLE_TAGS).map((tag) => (
            <Badge key={tag} variant="outline" className={chipClassName} asChild>
              <button
                type="button"
                aria-pressed={activeTags.includes(normalizeTag(tag))}
                aria-label={`Filter by tag ${tag}`}
                onClick={() => onTag(tag)}
              >
                #{tag}
              </button>
            </Badge>
          ))}
          {addon.tags.length > VISIBLE_TAGS ? (
            <Badge
              variant="outline"
              className="text-muted-foreground font-normal"
              title={addon.tags
                .slice(VISIBLE_TAGS)
                .map((tag) => `#${tag}`)
                .join(' ')}
            >
              +{addon.tags.length - VISIBLE_TAGS}
            </Badge>
          ) : null}
        </div>
      </CardContent>

      <CardFooter className="min-h-8 justify-between gap-3 border-t pt-4 [.border-t]:pt-4">
        <CardFacts addon={addon} incompatible={incompatible} />
        <div className="relative z-10 w-40 shrink-0">
          {installing ? (
            <StateButton tone="info" state="Installing" pending />
          ) : manageable ? (
            <InstalledStateButton addon={addon} installed={manageable} />
          ) : disabledRecord ? (
            <StateButton
              tone="neutral"
              state="Disabled"
              action={{
                label: 'Install again',
                icon: DownloadIcon,
                ariaLabel: `Install ${addon.qualified_name}`,
                onClick: onInstall,
              }}
              disabled={installDisabled}
            />
          ) : (
            <Button
              size="sm"
              variant="outline"
              className="w-full"
              disabled={installDisabled}
              title={incompatible ?? undefined}
              onClick={onInstall}
              aria-label={`Install ${addon.qualified_name}`}
            >
              <DownloadIcon aria-hidden data-icon="inline-start" />
              Install
            </Button>
          )}
        </div>
      </CardFooter>
    </Card>
  );
}
