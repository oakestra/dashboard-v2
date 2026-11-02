import { useCurrentUser, useOakestraApi } from '@oakestra/dashboard-sdk';
import { PageHeader, SectionCard, Skeleton } from '@oakestra/ui';
import { useQuery } from '@tanstack/react-query';

import { QueryErrorAlert } from '../../../components/QueryErrorAlert';
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
    <div className="space-y-6">
      <PageHeader title="Profile" description="Your account and what you can do with it." />

      {profile.isPending ? (
        <div className="grid gap-4 lg:grid-cols-2" data-testid="profile-loading">
          <Skeleton className="h-56 w-full" />
          <Skeleton className="h-56 w-full" />
        </div>
      ) : profile.isError ? (
        <QueryErrorAlert
          title="Could not load your profile"
          error={profile.error}
          onRetry={() => void profile.refetch()}
        />
      ) : (
        <>
          <div className="grid items-start gap-4 lg:grid-cols-2">
            <AccountCard profile={profile.data} user={user} />
            <SectionCard title="Security" description="Protect access to your account.">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="text-sm">
                  <div className="font-medium">Password</div>
                  <div className="text-muted-foreground">Change the password you log in with.</div>
                </div>
                <ChangePasswordDialog username={user.username} />
              </div>
            </SectionCard>
          </div>
          {/* Roles from the profile are fresher than the token's, which only change on refresh. */}
          <RolesCard roles={profile.data.roles ?? user.roles} />
        </>
      )}
    </div>
  );
}
