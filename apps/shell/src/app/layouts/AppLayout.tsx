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
} from '@oakestra/ui';
import { useCurrentUser } from '@oakestra/dashboard-sdk';
import { Suspense } from 'react';
import { Link, Outlet } from 'react-router';

import { OakestraLogo } from '../../components/OakestraLogo';
import { AppNav, AppNavFooter } from './AppNav';
import { Breadcrumbs } from './Breadcrumbs';
import { OrganizationBadge } from './OrganizationBadge';
import { UserMenu } from './UserMenu';

export function AppLayout() {
  // requireAuth guarantees a user when the layout mounts. When the session ends, the page is
  // unmounted right away instead of re-rendering without a user until the redirect to /login
  // lands, so pages below can rely on useCurrentUser() being set.
  const signedIn = useCurrentUser() !== null;

  return (
    <SidebarProvider>
      <Sidebar collapsible="icon">
        {/* Same height and rule as the top bar, so the two read as one line across the page. */}
        <SidebarHeader className="h-14 justify-center border-b border-sidebar-border">
          <Link
            to="/"
            aria-label="Oakestra home"
            className="flex h-9 items-center rounded-md px-2 outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0"
          >
            {/* The collapsed icon rail is too narrow for the lettering, so it shows only the tree. */}
            <span className="group-data-[collapsible=icon]:hidden">
              <OakestraLogo className="h-6" />
            </span>
            <span className="hidden group-data-[collapsible=icon]:block">
              <OakestraLogo variant="mark" className="size-6" />
            </span>
          </Link>
        </SidebarHeader>
        <SidebarContent>
          <AppNav />
        </SidebarContent>
        <SidebarFooter className="border-t border-sidebar-border">
          <AppNavFooter />
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>
      <SidebarInset>
        <header className="bg-background/85 supports-[backdrop-filter]:bg-background/70 sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2 border-b px-4 backdrop-blur md:px-6">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-1 data-[orientation=vertical]:h-4" />
          <Breadcrumbs />
          <div className="ml-auto flex shrink-0 items-center gap-2">
            <OrganizationBadge />
            <UserMenu />
          </div>
        </header>
        {/* SidebarInset already is the <main> landmark. Pages share one width and gutter. */}
        <div className="mx-auto w-full max-w-7xl min-w-0 flex-1 px-4 py-6 md:px-6 md:py-8 lg:px-8">
          <Suspense fallback={null}>{signedIn ? <Outlet /> : null}</Suspense>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
