import { SectionCard } from '@oakestra/ui';

// Admins only: the route declares `roles: ['Admin']`, so the shell shows its 403 page to others.
export function SettingsPage() {
  return (
    <SectionCard title="Example addon settings" data-testid="example-settings">
      <p className="ex:text-sm">The example addon has no settings.</p>
    </SectionCard>
  );
}
