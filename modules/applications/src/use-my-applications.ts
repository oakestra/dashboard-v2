import {
  applicationsQuery,
  profileQuery,
  useCurrentUser,
  useOakestraApi,
} from '@oakestra/dashboard-sdk';
import { useQuery } from '@tanstack/react-query';

/**
 * The current user's applications. `GET /applications/{userId}` takes the user's `_id`, not the
 * name, so the profile has to load first.
 */
export function useMyApplications() {
  const user = useCurrentUser();
  const api = useOakestraApi();

  // The pages are behind the login, so the user is always set; `enabled` only satisfies types.
  const profile = useQuery({
    ...profileQuery(api, user?.username ?? ''),
    enabled: user !== null,
  });
  const userId = profile.data?._id;
  const applications = useQuery({
    ...applicationsQuery(api, userId ?? ''),
    enabled: userId !== undefined,
  });

  return {
    applications,
    /** The profile or the application list is still loading. */
    isPending: profile.isPending || applications.isPending,
    error: profile.error ?? applications.error,
    retry: () => void (profile.isError ? profile.refetch() : applications.refetch()),
  };
}
