import { useCurrentUser, useOakestraApi } from '@oakestra/dashboard-sdk';
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Skeleton,
} from '@oakestra/ui';
import { useQuery } from '@tanstack/react-query';

import { describeError } from '../../../core/api/errors';
import { profileQuery } from '../api/queries';
import { AccountCard } from '../components/AccountCard';
import { ChangePasswordDialog } from '../components/ChangePasswordDialog';
import { EmailCard } from '../components/EmailCard';
import { RolesCard } from '../components/RolesCard';

export function ProfilePage() {
  // The app layout only renders pages while a user is logged in.
  const user = useCurrentUser()!;
  const api = useOakestraApi();
  const profile = useQuery(profileQuery(api, user.username));

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Profile</h1>
        <p className="text-muted-foreground text-sm">Your account and what you can do with it.</p>
      </div>

      {profile.isPending ? (
        <div className="space-y-4" data-testid="profile-loading">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-28 w-full" />
        </div>
      ) : profile.isError ? (
        <Alert variant="destructive">
          <AlertTitle>Could not load your profile</AlertTitle>
          <AlertDescription>
            <p>{describeError(profile.error)}</p>
            <Button
              size="sm"
              variant="outline"
              className="mt-2"
              onClick={() => void profile.refetch()}
            >
              Try again
            </Button>
          </AlertDescription>
        </Alert>
      ) : (
        <>
          <AccountCard profile={profile.data} user={user} />
          <EmailCard username={user.username} email={profile.data.email} />
          {/* Roles from the profile are fresher than the token's, which only change on refresh. */}
          <RolesCard roles={profile.data.roles ?? user.roles} />
          <Card>
            <CardHeader>
              <CardTitle>Password</CardTitle>
              <CardDescription>Change the password you log in with.</CardDescription>
            </CardHeader>
            <CardContent>
              <ChangePasswordDialog username={user.username} />
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
