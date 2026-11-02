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
        <dl className="ex:grid ex:grid-cols-[auto_1fr] ex:gap-x-4 ex:gap-y-1 ex:text-sm">
          <dt className="ex:text-muted-foreground">Addon</dt>
          <dd>{addonId}</dd>
          <dt className="ex:text-muted-foreground">Version</dt>
          <dd>{version}</dd>
          <dt className="ex:text-muted-foreground">Base path</dt>
          <dd>{basePath}</dd>
        </dl>
      </CardContent>
    </Card>
  );
}
