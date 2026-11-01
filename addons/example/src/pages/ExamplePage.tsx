import {
  addonQueryKey,
  useAddonBasePath,
  useCurrentUser,
  useNotify,
} from '@oakestra/dashboard-sdk';
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@oakestra/ui';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';

import { useSingletonProbe } from '../debug';

export function ExamplePage() {
  useSingletonProbe();
  const user = useCurrentUser();
  const notify = useNotify();
  const basePath = useAddonBasePath();
  const greeting = useQuery({
    queryKey: addonQueryKey('example', 'greeting'),
    queryFn: () => Promise.resolve(`Hello ${user?.username ?? 'stranger'}`),
  });

  return (
    <div className="space-y-6">
      {/* The fuchsia banner is what the e2e suite checks computed styles on: the shell never uses
          this color, so it only renders correctly if the addon's own CSS was loaded. */}
      <div
        data-testid="example-banner"
        className="rounded-lg border-l-4 border-fuchsia-600 bg-fuchsia-50 px-4 py-3 text-fuchsia-900"
      >
        Example addon page, rendered by a remote loaded at runtime.
      </div>
      <Card>
        <CardHeader>
          <CardTitle data-testid="example-greeting">{greeting.data ?? '...'}</CardTitle>
          <CardDescription>Mounted at {basePath}</CardDescription>
        </CardHeader>
        <CardContent className="flex gap-2">
          <Button onClick={() => notify.success('Hello from the example addon')}>Notify</Button>
          <Button asChild variant="outline">
            <Link to={`${basePath}/details/42`}>Open a nested page</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
