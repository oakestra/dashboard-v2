import { useCurrentUser, type NavGroup } from '@oakestra/dashboard-sdk';
import { ActivityIcon, type LucideIcon } from 'lucide-react';
import { useMemo } from 'react';
import { useLocation } from 'react-router';

import { useAppConfig } from '../../core/config/config-context';
import { usePreset } from '../../core/config/preset-context';
import { useContributions } from '../../core/extensions/use-contributions';
import { applyNavOverrides, buildNavEntries, findActiveKey } from './nav-model';

export interface ExternalLink {
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

/**
 * What the sidebar lists, for everything that offers the same destinations: the user's roles and
 * the deployment preset are applied, so a page hidden there is hidden everywhere.
 */
export function useNav() {
  // Role filtering of top-level items happens in useContributions, the same way for core modules
  // and addons; buildNavEntries applies it to the sub-items.
  const items = useContributions('nav.items');
  const user = useCurrentUser();
  const { nav } = usePreset();
  const entries = useMemo(
    () => applyNavOverrides(buildNavEntries(items, user), nav.items),
    [items, user, nav.items],
  );
  return { entries, externalLinks: useExternalLinks() };
}

/** `useNav` by sidebar group, with the link that matches the current page. */
export function useActiveNav() {
  const { entries, externalLinks } = useNav();
  const { pathname } = useLocation();
  // Computed over every entry, footer included, so exactly one link in the sidebar is active.
  const activeKey = findActiveKey(entries, pathname);
  const inGroup = (group: NavGroup) => ({
    entries: entries.filter(({ item }) => (item.group ?? 'main') === group),
    links: externalLinks.filter((link) => link.group === group),
  });
  return { activeKey, inGroup };
}
