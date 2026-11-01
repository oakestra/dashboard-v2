import { OakestraLogo } from '../../components/OakestraLogo';

/**
 * Shown while the session is restored and the first route module loads, before any layout
 * exists. It may turn out to be the login page or the app, so it is a quiet brand mark rather
 * than a skeleton of either.
 */
export function PageSkeleton() {
  return (
    <div className="flex min-h-svh items-center justify-center" role="status">
      <span className="animate-pulse motion-reduce:animate-none">
        <OakestraLogo variant="mark" className="size-10 opacity-80" />
      </span>
      <span className="sr-only">Loading</span>
    </div>
  );
}
