import { Suspense } from 'react';
import { Outlet } from 'react-router';

import { OakestraLogo } from '../../components/OakestraLogo';

/** Frame for pages without a session: login and password reset. */
export function AuthLayout() {
  return (
    <div className="bg-background flex min-h-svh flex-col items-center px-4 py-10 sm:py-16">
      <div className="flex w-full max-w-sm flex-1 flex-col justify-center gap-8">
        <OakestraLogo className="mx-auto h-9" />
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
  );
}
