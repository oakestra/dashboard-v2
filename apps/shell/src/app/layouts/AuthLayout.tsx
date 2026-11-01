import { Suspense } from 'react';
import { Outlet } from 'react-router';

import { OakestraLogo } from '../../components/OakestraLogo';

/** Frame for pages without a session: login and password reset. */
export function AuthLayout() {
  return (
    <div className="bg-muted/40 flex min-h-svh flex-col items-center justify-center gap-6 p-6">
      <OakestraLogo className="h-10" />
      <main className="w-full max-w-sm">
        <Suspense fallback={null}>
          <Outlet />
        </Suspense>
      </main>
    </div>
  );
}
