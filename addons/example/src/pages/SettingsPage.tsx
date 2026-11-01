import { usePermissions } from '@oakestra/dashboard-sdk';
import { EmptyState, SectionCard } from '@oakestra/ui';
import { LockIcon } from 'lucide-react';

export function SettingsPage() {
  const permissions = usePermissions();
  // `roles` on the nav sub-item only keeps the link away from non-admins. Addon routes have no
  // role check of their own: anyone can type the URL, so the page has to refuse by itself.
  if (!permissions.hasRole('Admin')) {
    return (
      <EmptyState
        icon={<LockIcon />}
        title="Administrators only"
        description="Ask an administrator to change the settings of the example addon."
      />
    );
  }
  return (
    <SectionCard title="Example addon settings" data-testid="example-settings">
      <p className="text-sm">The example addon has no settings.</p>
    </SectionCard>
  );
}
