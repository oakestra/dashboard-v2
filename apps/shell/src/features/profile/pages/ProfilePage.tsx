import { useCurrentUser, useOakestraApi } from '@oakestra/dashboard-sdk';
import { PageHeader, Skeleton, QueryErrorAlert } from '@oakestra/ui';
import { useQuery } from '@tanstack/react-query';

import { profileQuery } from '../api/queries';
import { AccountCard } from '../components/AccountCard';
import { ChangePasswordDialog } from '../components/ChangePasswordDialog';
import { RolesCard } from '../components/RolesCard';

export function ProfilePage() {
  // The app layout only renders pages while a user is logged in.
  const user = useCurrentUser()!;
  const api = useOakestraApi();
  const profile = useQuery(profileQuery(api, user.username));

  return (
    <div className="space-y-4">
      <PageHeader title="Profile" description="Your account and what you can do with it." />

      {profile.isPending ? (
        <Skeleton className="h-72 w-full max-w-3xl" data-testid="profile-loading" />
      ) : profile.isError ? (
        <QueryErrorAlert
          title="Could not load your profile"
          error={profile.error}
          onRetry={() => void profile.refetch()}
        />
      ) : (
        <div className="bg-card max-w-3xl divide-y rounded-lg border">
          <AccountCard profile={profile.data} user={user} />
          <section aria-label="Security" className="py-3">
            <h2 className="px-4 pb-2 text-sm font-semibold">Security</h2>
            <div className="flex flex-wrap items-center justify-between gap-3 px-4 text-sm">
              <div>
                <div>Password</div>
                <div className="text-muted-foreground">Change the password you log in with.</div>
              </div>
              <ChangePasswordDialog username={user.username} />
            </div>
          </section>
          {/* Roles from the profile are fresher than the token's, which only change on refresh. */}
          <RolesCard roles={profile.data.roles ?? user.roles} />
        </div>
      )}
    </div>
  );
}
