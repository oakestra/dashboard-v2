import {
  addonQueryKey,
  useAddonBasePath,
  useAddonPath,
  useCurrentUser,
  useNotify,
} from '@oakestra/dashboard-sdk';
import { Button, PageHeader, SectionCard } from '@oakestra/ui';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { ADDON_ID } from 'virtual:oakestra-addon';

import { useSingletonProbe } from '../debug';

export function ExamplePage() {
  useSingletonProbe();
  const user = useCurrentUser();
  const notify = useNotify();
  const basePath = useAddonBasePath();
  const addonPath = useAddonPath();
  const greeting = useQuery({
    queryKey: addonQueryKey(ADDON_ID, 'greeting'),
    queryFn: () => Promise.resolve(`Hello ${user?.username ?? 'stranger'}`),
  });

  return (
    <div className="ex:space-y-5">
      <PageHeader
        title={<span data-testid="example-greeting">{greeting.data ?? '...'}</span>}
        description={`Mounted at ${basePath}`}
      />
      {/* The fuchsia banner is what the e2e suite checks computed styles on: the shell never uses
          this color, so it only renders correctly if the addon's own CSS was loaded. */}
      <div
        data-testid="example-banner"
        className="ex:rounded-md ex:border-l-4 ex:border-fuchsia-600 ex:bg-fuchsia-50 ex:px-4 ex:py-2 ex:text-sm ex:text-fuchsia-900"
      >
        Example addon page, rendered by a remote loaded at runtime.
      </div>
      <SectionCard title="Try it" description="Shell services available to an addon.">
        <div className="ex:flex ex:flex-wrap ex:gap-2">
          <Button onClick={() => notify.success('Hello from the example addon')}>Notify</Button>
          <Button asChild variant="outline">
            <Link to={addonPath('details', 42)}>Open a nested page</Link>
          </Button>
        </div>
      </SectionCard>
    </div>
  );
}
