import type { NavGroup } from '@oakestra/dashboard-sdk';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  cn,
  useSidebar,
} from '@oakestra/ui';
import { ChevronRightIcon, ExternalLinkIcon } from 'lucide-react';
import { useState, type ComponentType } from 'react';
import { Link } from 'react-router';

import { usePreset } from '../../core/config/preset-context';
import { ContributionBoundary } from '../../core/extensions/ContributionBoundary';
import { ErrorBoundary } from '../../core/extensions/ErrorBoundary';
import type { ContributionSource } from '../../core/extensions/registry';
import type { NavEntry as NavEntryModel } from './nav-model';
import { useActiveNav, type ExternalLink } from './use-nav';

/** Groups listed in the scrolling part of the sidebar, in this order, under these headings. */
const GROUPS: readonly { id: Exclude<NavGroup, 'footer'>; label: string }[] = [
  { id: 'main', label: 'Platform' },
  { id: 'management', label: 'Management' },
  { id: 'addons', label: 'Addons' },
];

/** The labelled groups in the scrolling part of the sidebar. */
export function AppNav() {
  const { activeKey, inGroup } = useActiveNav();
  const { nav } = usePreset();
  return GROUPS.map((group) => {
    const { entries, links } = inGroup(group.id);
    if (entries.length === 0 && links.length === 0) return null;
    return (
      <SidebarGroup key={group.id}>
        <SidebarGroupLabel>{nav.groupLabels[group.id] ?? group.label}</SidebarGroupLabel>
        <SidebarGroupContent>
          <NavMenu entries={entries} links={links} activeKey={activeKey} />
        </SidebarGroupContent>
      </SidebarGroup>
    );
  });
}

/**
 * The `footer` group (Help, Settings), meant for a `SidebarFooter`: it stays at the bottom of the
 * sidebar, outside the scrolling area, however long the list above gets.
 */
export function AppNavFooter() {
  const { activeKey, inGroup } = useActiveNav();
  const { entries, links } = inGroup('footer');
  if (entries.length === 0 && links.length === 0) return null;
  return <NavMenu entries={entries} links={links} activeKey={activeKey} />;
}

function NavMenu({
  entries,
  links,
  activeKey,
}: {
  entries: readonly NavEntryModel[];
  links: readonly ExternalLink[];
  activeKey: string | undefined;
}) {
  return (
    <SidebarMenu>
      {entries.map((entry) =>
        entry.children.length > 0 ? (
          <ExpandableNavEntry key={entry.key} entry={entry} activeKey={activeKey} />
        ) : (
          <SidebarMenuItem key={entry.key}>
            <NavEntryButton entry={entry} active={activeKey === entry.key} />
            {entry.item.badge ? (
              <NavBadge
                badge={entry.item.badge}
                source={entry.source}
                label={entry.item.label}
                testId={`nav-badge-${entry.source.id}-${entry.item.id}`}
              />
            ) : null}
          </SidebarMenuItem>
        ),
      )}
      {links.map((link) => (
        <SidebarMenuItem key={link.id}>
          <SidebarMenuButton asChild tooltip={link.label}>
            <a
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              data-testid={`nav-external-${link.id}`}
            >
              <link.icon className="size-4" />
              <span>{link.label}</span>
              <ExternalLinkIcon className="text-sidebar-foreground/60 ml-auto size-3" aria-hidden />
            </a>
          </SidebarMenuButton>
        </SidebarMenuItem>
      ))}
    </SidebarMenu>
  );
}

/** On phones the navigation is a sheet over the page; it has to get out of the way once a page
 * was picked, otherwise the user lands on the new page still looking at the menu. */
function useCloseMobileNav(): () => void {
  const { isMobile, setOpenMobile } = useSidebar();
  return () => {
    if (isMobile) setOpenMobile(false);
  };
}

function NavEntryButton({ entry, active }: { entry: NavEntryModel; active: boolean }) {
  const { item, source } = entry;
  const closeMobileNav = useCloseMobileNav();
  return (
    <SidebarMenuButton asChild isActive={active} tooltip={item.label}>
      {/* Link instead of NavLink: NavLink would mark every prefix match as the current page, while
          findActiveKey picks exactly one entry. */}
      <Link
        to={item.path}
        aria-current={active ? 'page' : undefined}
        data-testid={`nav-${source.id}-${item.id}`}
        onClick={closeMobileNav}
      >
        {item.icon ? (
          // An addon icon that throws must not take the whole navigation down with it.
          <ErrorBoundary fallback={() => null}>
            <item.icon className="size-4" />
          </ErrorBoundary>
        ) : null}
        <span>{item.label}</span>
      </Link>
    </SidebarMenuButton>
  );
}

function ExpandableNavEntry({
  entry,
  activeKey,
}: {
  entry: NavEntryModel;
  activeKey: string | undefined;
}) {
  const { item, source, children } = entry;
  const { isMobile, state } = useSidebar();
  const closeMobileNav = useCloseMobileNav();
  const childActive = children.some((child) => child.key === activeKey);
  const inside = activeKey === entry.key || childActive;

  // Opens whenever the route enters this entry, but leaves it to the user otherwise: collapsing it
  // while on one of its pages sticks, and leaving does not snap it shut.
  const [open, setOpen] = useState(inside);
  const [wasInside, setWasInside] = useState(inside);
  if (inside !== wasInside) {
    setWasInside(inside);
    if (inside) setOpen(true);
  }

  // When the active child cannot be seen (icon-only sidebar, or the user collapsed this entry), the
  // parent stands in for it so the sidebar still shows where the user is.
  const subMenuHidden = state === 'collapsed' && !isMobile;
  const active = activeKey === entry.key || (childActive && (subMenuHidden || !open));

  return (
    <Collapsible asChild open={open} onOpenChange={setOpen}>
      <SidebarMenuItem>
        <NavEntryButton entry={entry} active={active} />
        {item.badge ? (
          <NavBadge
            badge={item.badge}
            source={source}
            label={item.label}
            testId={`nav-badge-${source.id}-${item.id}`}
            // Left of the chevron, which takes the usual badge spot.
            className="right-7"
          />
        ) : null}
        <CollapsibleTrigger asChild>
          <SidebarMenuAction
            className="data-[state=open]:rotate-90"
            aria-label={`Toggle ${item.label}`}
            data-testid={`nav-toggle-${source.id}-${item.id}`}
          >
            <ChevronRightIcon />
          </SidebarMenuAction>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <SidebarMenuSub>
            {children.map((child) => {
              const childIsActive = activeKey === child.key;
              return (
                <SidebarMenuSubItem key={child.key}>
                  <SidebarMenuSubButton asChild isActive={childIsActive}>
                    <Link
                      to={child.item.path}
                      aria-current={childIsActive ? 'page' : undefined}
                      data-testid={`nav-${source.id}-${item.id}-${child.item.id}`}
                      onClick={closeMobileNav}
                    >
                      <span>{child.item.label}</span>
                    </Link>
                  </SidebarMenuSubButton>
                  {child.item.badge ? (
                    <NavBadge
                      badge={child.item.badge}
                      source={source}
                      label={child.item.label}
                      testId={`nav-badge-${source.id}-${item.id}-${child.item.id}`}
                      // SidebarMenuBadge sets its top offset from a sibling menu-button peer,
                      // which a sub-item does not have.
                      className="top-1"
                    />
                  ) : null}
                </SidebarMenuSubItem>
              );
            })}
          </SidebarMenuSub>
        </CollapsibleContent>
      </SidebarMenuItem>
    </Collapsible>
  );
}

// `quiet` because an error message does not fit in a badge; `empty:hidden` drops the box when the
// badge renders null.
function NavBadge({
  badge: Badge,
  source,
  label,
  testId,
  className,
}: {
  badge: ComponentType;
  source: ContributionSource;
  label: string;
  testId: string;
  className?: string;
}) {
  return (
    <SidebarMenuBadge data-testid={testId} className={cn('empty:hidden', className)}>
      <ContributionBoundary source={source} label={`Badge of ${label}`} fallback={null} quiet>
        <Badge />
      </ContributionBoundary>
    </SidebarMenuBadge>
  );
}
