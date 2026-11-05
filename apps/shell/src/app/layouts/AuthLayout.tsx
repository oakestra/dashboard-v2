import { Suspense } from 'react';
import { Outlet } from 'react-router';

import { OakestraLogo } from '../../components/OakestraLogo';
import { OrchestrationTree } from './OrchestrationTree';

/** Frame for pages without a session: login and password reset. */
export function AuthLayout() {
  return (
    <div className="bg-background grid min-h-svh lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <aside className="bg-sidebar text-sidebar-foreground hidden flex-col justify-between p-10 lg:flex">
        <OakestraLogo surface="inverse" className="h-8 self-start" />
        <OrchestrationTree className="w-full max-w-xl" />
        <p className="max-w-sm text-sm text-pretty">
          Run workloads across clusters and edge devices from one root orchestrator.
        </p>
      </aside>
      <div className="flex flex-col items-center px-4 py-10">
        <div className="flex w-full max-w-sm flex-1 flex-col justify-center gap-8">
          {/* On a wrapper: the logo's own dark:block would beat lg:hidden on the image. */}
          <div className="lg:hidden">
            <OakestraLogo className="h-8" />
          </div>
          <main>
            <Suspense fallback={null}>
              <Outlet />
            </Suspense>
          </main>
        </div>
        <footer className="text-muted-foreground mt-10 text-xs">
          <a
            href="https://www.oakestra.io/docs/"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-foreground underline-offset-4 hover:underline"
          >
            Oakestra documentation
          </a>
        </footer>
      </div>
    </div>
  );
}
