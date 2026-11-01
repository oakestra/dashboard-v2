import { useAddonContext } from '@oakestra/dashboard-sdk';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@oakestra/ui';

export function AboutPage() {
  const { addonId, version, basePath } = useAddonContext();
  return (
    <Card>
      <CardHeader>
        <CardTitle data-testid="example-about">About the example addon</CardTitle>
        <CardDescription>
          A second page, reached through a nested item under the addon&apos;s sidebar entry.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          <dt className="text-muted-foreground">Addon</dt>
          <dd>{addonId}</dd>
          <dt className="text-muted-foreground">Version</dt>
          <dd>{version}</dd>
          <dt className="text-muted-foreground">Base path</dt>
          <dd>{basePath}</dd>
        </dl>
      </CardContent>
    </Card>
  );
}
