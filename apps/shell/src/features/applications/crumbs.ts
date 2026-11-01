import type { LoaderFunctionArgs, UIMatch } from 'react-router';

import { requireAuth } from '../../core/auth/guards';
import { appRouterContext } from '../../core/router/app-context';
import { applicationQuery } from './api/queries';

export interface ApplicationCrumbData {
  name: string;
}

/**
 * Loads the application so its name can be a breadcrumb, and so an unknown id fails as a route
 * error instead of an empty page. Child loaders run in parallel with the layout's `requireAuth`,
 * hence the explicit check first.
 */
export async function applicationCrumbLoader(
  args: LoaderFunctionArgs,
): Promise<ApplicationCrumbData> {
  await requireAuth(args);
  const { api, queryClient } = args.context.get(appRouterContext);
  const application = await queryClient.ensureQueryData(applicationQuery(api, args.params.appId!));
  return { name: application.application_name };
}

export function applicationCrumb(match: UIMatch): string {
  return (match.loaderData as ApplicationCrumbData | undefined)?.name ?? 'Application';
}
