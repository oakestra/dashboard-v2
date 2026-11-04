import { useCurrentUser, type NavGroup } from '@oakestra/dashboard-sdk';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from '@oakestra/ui';
import { ActivityIcon, ChevronRightIcon, ExternalLinkIcon, type LucideIcon } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router';

import { useAppConfig } from '../../core/config/config-context';
import { usePreset } from '../../core/config/preset-context';
import { ErrorBoundary } from '../../core/extensions/ErrorBoundary';
import { useContributions } from '../../core/extensions/use-contributions';
import {
  applyNavOverrides,
  buildNavEntries,
  findActiveKey,
  type NavEntry as NavEntryModel,
} from './nav-model';

/** Groups listed in the scrolling part of the sidebar, in this order, under these headings. */
const GROUPS: readonly { id: Exclude<NavGroup, 'footer'>; label: string }[] = [
  { id: 'main', label: 'Platform' },
  { id: 'management', label: 'Management' },
  { id: 'addons', label: 'Addons' },
];

interface ExternalLink {
  id: string;
  label: string;
  href: string;
  icon: LucideIcon;
  group: NavGroup;
}

/** Links to tools outside the dashboard, configured per deployment in config.json. */
function useExternalLinks(): ExternalLink[] {
  const config = useAppConfig();
  const links: ExternalLink[] = [];
  if (config.grafanaUrl) {
    links.push({
      id: 'grafana',
      label: 'Grafana',
      href: config.grafanaUrl,
      icon: ActivityIcon,
      group: 'management',
    });
  }
  return links;
}

function useNav() {
  // Role filtering of top-level items happens in useContributions, the same way for core modules
  // and addons; buildNavEntries applies it to the sub-items.
  const items = useContributions('nav.items');
  const user = useCurrentUser();
  const { nav } = usePreset();
  const entries = useMemo(
    () => applyNavOverrides(buildNavEntries(items, user), nav.items),
    [items, user, nav.items],
  );
  const externalLinks = useExternalLinks();
  const { pathname } = useLocation();
  // Computed over every entry, footer included, so exactly one link in the sidebar is active.
  const activeKey = findActiveKey(entries, pathname);
  const inGroup = (group: NavGroup) => ({
    entries: entries.filter(({ item }) => (item.group ?? 'main') === group),
    links: externalLinks.filter((link) => link.group === group),
  });
  return { activeKey, inGroup };
}

/** The labelled groups in the scrolling part of the sidebar. */
export function AppNav() {
  const { activeKey, inGroup } = useNav();
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
  const { activeKey, inGroup } = useNav();
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
              <ExternalLinkIcon className="text-muted-foreground ml-auto size-3" aria-hidden />
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
                </SidebarMenuSubItem>
              );
            })}
          </SidebarMenuSub>
        </CollapsibleContent>
      </SidebarMenuItem>
    </Collapsible>
  );
}
