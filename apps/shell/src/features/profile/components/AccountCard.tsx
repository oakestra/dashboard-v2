import type { User } from '@oakestra/api';
import { ROOT_ORGANIZATION_NAME } from '@oakestra/api';
import { usePermissions, type CurrentUser } from '@oakestra/dashboard-sdk';
import { formatDate, formatDateTime, parseLegacyDate } from '@oakestra/ui';

import type { ReactNode } from 'react';

import { EmailField } from './EmailField';

export function AccountCard({ profile, user }: { profile: User; user: CurrentUser }) {
  // The backend lets only admins change user records, including their own.
  const canEditEmail = usePermissions().hasRole('Admin');
  const created = parseLegacyDate(profile.created_at);

  return (
    <section aria-label="Account" className="py-3">
      <h2 className="px-4 pb-2 text-sm font-semibold">Account</h2>
      <dl className="divide-y text-sm">
        <Row label="Username">
          <span data-testid="account-username">{profile.name}</span>
        </Row>
        <Row label="Organization">
          <span data-testid="account-organization">
            {user.organizationName ?? ROOT_ORGANIZATION_NAME}
          </span>
        </Row>
        <Row label="Member since">
          <span data-testid="account-member-since">
            {created ? (
              <time dateTime={created.toISOString()} title={formatDateTime(created)}>
                {formatDate(created)}
              </time>
            ) : (
              (profile.created_at ?? 'Unknown')
            )}
          </span>
        </Row>
        <Row label="Email">
          <div data-testid="account-email">
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
          </div>
        </Row>
      </dl>
    </section>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-1 px-4 py-2 sm:grid-cols-[12rem_1fr] sm:items-center sm:gap-6">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0">{children}</dd>
    </div>
  );
}
