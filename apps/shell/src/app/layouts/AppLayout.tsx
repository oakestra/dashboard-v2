import {
  Separator,
  Sidebar,
  SidebarContent,
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
import { AppNav } from './AppNav';
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
        <SidebarHeader>
          <Link
            to="/"
            className="flex h-9 items-center px-2 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0"
          >
            {/* The collapsed icon rail is too narrow for the lettering, so it shows only the tree. */}
            <span className="group-data-[collapsible=icon]:hidden">
              <OakestraLogo className="h-7" />
            </span>
            <span className="hidden group-data-[collapsible=icon]:block">
              <OakestraLogo variant="mark" className="size-6" />
            </span>
          </Link>
        </SidebarHeader>
        <SidebarContent>
          <AppNav />
        </SidebarContent>
        <SidebarRail />
      </Sidebar>
      <SidebarInset>
        <header className="bg-background sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 data-[orientation=vertical]:h-4" />
          <Breadcrumbs />
          <div className="ml-auto flex items-center gap-3">
            <OrganizationBadge />
            <UserMenu />
          </div>
        </header>
        {/* SidebarInset already is the <main> landmark. */}
        <div className="flex-1 p-4 md:p-6">
          <Suspense fallback={null}>{signedIn ? <Outlet /> : null}</Suspense>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
