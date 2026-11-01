import type { LoaderFunctionArgs, UIMatch } from 'react-router';

import { requireAuth } from '../../core/auth/guards';
import { appRouterContext } from '../../core/router/app-context';
import { serviceQuery } from './api/queries';

export async function serviceCrumbLoader(args: LoaderFunctionArgs): Promise<{ name: string }> {
  await requireAuth(args);
  const { api, queryClient } = args.context.get(appRouterContext);
  const service = await queryClient.ensureQueryData(serviceQuery(api, args.params.serviceId!));
  return { name: service.microservice_name };
}

export function serviceCrumb(match: UIMatch): string {
  return (match.loaderData as { name: string } | undefined)?.name ?? 'Service';
}
