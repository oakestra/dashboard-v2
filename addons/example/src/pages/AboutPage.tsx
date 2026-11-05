import { useAddonContext } from '@oakestra/dashboard-sdk';
import { SectionCard } from '@oakestra/ui';

export function AboutPage() {
  const { addonId, version, basePath } = useAddonContext();
  return (
    <SectionCard
      title={<span data-testid="example-about">About the example addon</span>}
      description="A second page, reached through a nested item under the addon's sidebar entry."
    >
      <dl className="ex:grid ex:grid-cols-[auto_1fr] ex:gap-x-6 ex:gap-y-1.5 ex:text-sm">
        <dt className="ex:text-muted-foreground">Addon</dt>
        <dd>{addonId}</dd>
        <dt className="ex:text-muted-foreground">Version</dt>
        <dd>{version}</dd>
        <dt className="ex:text-muted-foreground">Base path</dt>
        <dd className="ex:font-mono ex:text-xs">{basePath}</dd>
      </dl>
    </SectionCard>
  );
}
