import {
  Separator,
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
  cn,
} from '@oakestra/ui';
import { useCurrentUser } from '@oakestra/dashboard-sdk';
import { Suspense } from 'react';
import { Link, Outlet, useMatches } from 'react-router';

import { isAddonPageMatch, useAddonFullWidth } from '../../core/addons/addon-crumbs';
import { pageFullWidth, type RouteHandle } from '../../core/router/route-handle';

import { OakestraLogo } from '../../components/OakestraLogo';
import { AddonIssuesNotice } from './AddonIssuesNotice';
import { AppNav, AppNavFooter } from './AppNav';
import { Breadcrumbs } from './Breadcrumbs';
import { CommandPalette } from './CommandPalette';
import { OrganizationBadge } from './OrganizationBadge';
import { usePageScroll } from './use-page-scroll';
import { UserMenu } from './UserMenu';

/** Whether the current page asked for the full width, with an addon page's own routes included. */
function useFullWidth(): boolean {
  const matches = useMatches();
  const addonMatch = matches.find(isAddonPageMatch);
  const addonValues = useAddonFullWidth(addonMatch);
  return pageFullWidth(
    matches.flatMap((match) =>
      match === addonMatch ? addonValues : [(match.handle as RouteHandle | undefined)?.fullWidth],
    ),
  );
}

export function AppLayout() {
  // requireAuth guarantees a user when the layout mounts. When the session ends, the page is
  // unmounted right away instead of re-rendering without a user until the redirect to /login
  // lands, so pages below can rely on useCurrentUser() being set.
  const signedIn = useCurrentUser() !== null;
  const fullWidth = useFullWidth();
  const panel = usePageScroll();

  return (
    <SidebarProvider>
      {/* The sidebar is about ten tab stops long, a keyboard user should not walk it on every page. */}
      <a
        href="#page-content"
        onClick={(event) => {
          event.preventDefault();
          document.getElementById('page-content')?.focus();
        }}
        className="bg-card focus-visible:ring-ring sr-only z-50 rounded-md px-3 py-1.5 text-sm font-medium focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus-visible:ring-2"
      >
        Skip to content
      </a>
      <Sidebar collapsible="icon" variant="inset">
        <SidebarHeader className="h-12 justify-center">
          <Link
            to="/"
            aria-label="Oakestra home"
            className="flex h-9 items-center rounded-md px-2 outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0"
          >
            {/* The collapsed icon rail is too narrow for the lettering, so it shows only the tree. */}
            <span className="group-data-[collapsible=icon]:hidden">
              <OakestraLogo className="h-[1.375rem]" />
            </span>
            <span className="hidden group-data-[collapsible=icon]:block">
              <OakestraLogo variant="mark" className="size-6" />
            </span>
          </Link>
        </SidebarHeader>
        <SidebarContent>
          <AppNav />
        </SidebarContent>
        <SidebarFooter>
          <AppNavFooter />
          <UserMenu />
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>
      {/* Scrolls inside the panel: with the page scrolling, content would slide past its rounded
          corners and the gap above it. */}
      <SidebarInset ref={panel} className="md:h-[calc(100svh-1rem)] md:overflow-y-auto">
        <header className="bg-background/85 sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2 border-b px-4 backdrop-blur md:px-6">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-1 data-[orientation=vertical]:h-4" />
          <Breadcrumbs />
          <div className="ml-auto flex shrink-0 items-center gap-2">
            {signedIn ? <CommandPalette /> : null}
            <OrganizationBadge />
          </div>
        </header>
        {/* SidebarInset already is the <main> landmark. Pages share one gutter, and one width
            unless a route asks for all of it (`fullWidth`). */}
        <div
          id="page-content"
          tabIndex={-1}
          data-testid="page-content"
          data-width={fullWidth ? 'full' : 'default'}
          className={cn(
            'mx-auto w-full min-w-0 flex-1 px-4 py-6 outline-none md:px-8 md:py-8',
            !fullWidth && 'max-w-7xl',
          )}
        >
          <AddonIssuesNotice />
          <Suspense fallback={null}>{signedIn ? <Outlet /> : null}</Suspense>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
