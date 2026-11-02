import type { User } from '@oakestra/api';
import { ROOT_ORGANIZATION_NAME } from '@oakestra/api';
import { usePermissions, type CurrentUser } from '@oakestra/dashboard-sdk';
import { SectionCard } from '@oakestra/ui';

import { formatDate, formatDateTime, parseLegacyDate } from '../../../lib/format';
import { EmailField } from './EmailField';

export function AccountCard({ profile, user }: { profile: User; user: CurrentUser }) {
  // The backend lets only admins change user records, including their own.
  const canEditEmail = usePermissions().hasRole('Admin');
  const created = parseLegacyDate(profile.created_at);

  return (
    <SectionCard title="Account" description="Who you are in this organization.">
      <dl className="grid grid-cols-[max-content_1fr] items-center gap-x-6 gap-y-3 text-sm">
        <dt className="text-muted-foreground">Username</dt>
        <dd data-testid="account-username">{profile.name}</dd>

        <dt className="text-muted-foreground">Organization</dt>
        <dd data-testid="account-organization">
          {user.organizationName ?? ROOT_ORGANIZATION_NAME}
        </dd>

        <dt className="text-muted-foreground">Member since</dt>
        <dd data-testid="account-member-since">
          {created ? (
            <time dateTime={created.toISOString()} title={formatDateTime(created)}>
              {formatDate(created)}
            </time>
          ) : (
            (profile.created_at ?? 'Unknown')
          )}
        </dd>

        <dt className="text-muted-foreground">Email</dt>
        <dd data-testid="account-email">
          {canEditEmail ? (
            <EmailField username={user.username} email={profile.email} />
          ) : (
            <>
              <span>{profile.email || 'Not set'}</span>
              <span className="text-muted-foreground mt-0.5 block text-xs">
                Ask an administrator to change it.
              </span>
            </>
          )}
        </dd>
      </dl>
    </SectionCard>
  );
}
