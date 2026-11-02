import type { Service } from '@oakestra/api';
import type { LoaderFunctionArgs, UIMatch } from 'react-router';

import { requireAuth } from '../../core/auth/guards';
import { seedFromLists } from '../../core/query/seed-from-lists';
import { appRouterContext } from '../../core/router/app-context';
import { serviceKeys, serviceQuery } from './api/queries';

export async function serviceCrumbLoader(args: LoaderFunctionArgs): Promise<{ name: string }> {
  await requireAuth(args);
  const { api, queryClient } = args.context.get(appRouterContext);
  const serviceId = args.params.serviceId!;
  const service = await queryClient.ensureQueryData({
    ...serviceQuery(api, serviceId),
    ...seedFromLists<Service>(
      queryClient,
      serviceKeys.lists(),
      (service) => service._id === serviceId,
    ),
  });
  return { name: service.microservice_name };
}

export function serviceCrumb(match: UIMatch): string {
  return (match.loaderData as { name: string } | undefined)?.name ?? 'Service';
}
