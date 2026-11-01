import type { NavGroup, NavItem } from '@oakestra/dashboard-sdk';
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@oakestra/ui';
import { ActivityIcon, ExternalLinkIcon, type LucideIcon } from 'lucide-react';
import { NavLink, useLocation } from 'react-router';

import { useAppConfig } from '../../core/config/config-context';
import { ErrorBoundary } from '../../core/extensions/ErrorBoundary';
import type { ResolvedContribution } from '../../core/extensions/registry';
import { useContributions } from '../../core/extensions/use-contributions';

const GROUPS: readonly { id: NavGroup; label: string }[] = [
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

export function AppNav() {
  // Role filtering happens in useContributions, the same way for core modules and addons.
  const items = useContributions('nav.items');
  const externalLinks = useExternalLinks();
  const { pathname } = useLocation();

  return GROUPS.map((group) => {
    const groupItems = items.filter(({ item }) => (item.group ?? 'main') === group.id);
    const groupLinks = externalLinks.filter((link) => link.group === group.id);
    if (groupItems.length === 0 && groupLinks.length === 0) return null;
    return (
      <SidebarGroup key={group.id}>
        <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            {groupItems.map((entry) => (
              <NavEntry
                key={`${entry.source.kind}:${entry.source.id}:${entry.item.id}`}
                entry={entry}
                pathname={pathname}
              />
            ))}
            {groupLinks.map((link) => (
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
                    <ExternalLinkIcon
                      className="text-muted-foreground ml-auto size-3"
                      aria-hidden
                    />
                  </a>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    );
  });
}

function NavEntry({
  entry,
  pathname,
}: {
  entry: ResolvedContribution<'nav.items'>;
  pathname: string;
}) {
  const { item, source } = entry;
  const active = isActive(item, pathname);
  // On phones the navigation is a sheet over the page; it has to get out of the way once a page
  // was picked, otherwise the user lands on the new page still looking at the menu.
  const { isMobile, setOpenMobile } = useSidebar();
  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild isActive={active} tooltip={item.label}>
        <NavLink
          to={item.path}
          end={item.path === '/'}
          data-testid={`nav-${source.id}-${item.id}`}
          onClick={() => {
            if (isMobile) setOpenMobile(false);
          }}
        >
          {item.icon ? (
            // An addon icon that throws must not take the whole navigation down with it.
            <ErrorBoundary fallback={() => null}>
              <item.icon className="size-4" />
            </ErrorBoundary>
          ) : null}
          <span>{item.label}</span>
        </NavLink>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

function isActive(item: NavItem, pathname: string): boolean {
  if (item.path === '/') return pathname === '/';
  return pathname === item.path || pathname.startsWith(`${item.path}/`);
}
