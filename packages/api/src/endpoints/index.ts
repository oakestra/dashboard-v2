import type { OakestraClient } from '../client.ts';
import { createApplicationEndpoints, type ApplicationEndpoints } from './applications.ts';
import { createAuthEndpoints, type AuthEndpoints } from './auth.ts';
import { createClusterEndpoints, type ClusterEndpoints } from './clusters.ts';
import { createInstanceEndpoints, type InstanceEndpoints } from './instances.ts';
import { createOrganizationEndpoints, type OrganizationEndpoints } from './organizations.ts';
import { createServiceEndpoints, type ServiceEndpoints } from './services.ts';
import { createUserEndpoints, type UserEndpoints } from './users.ts';

/**
 * The typed system-manager API. Every function validates the response with the Zod models and
 * throws an ApiError on any failure.
 */
export interface OakestraEndpoints {
  readonly auth: AuthEndpoints;
  readonly applications: ApplicationEndpoints;
  readonly services: ServiceEndpoints;
  readonly instances: InstanceEndpoints;
  readonly clusters: ClusterEndpoints;
  readonly users: UserEndpoints;
  readonly organizations: OrganizationEndpoints;
}

export function createOakestraApi(client: OakestraClient): OakestraEndpoints {
  return {
    auth: createAuthEndpoints(client),
    applications: createApplicationEndpoints(client),
    services: createServiceEndpoints(client),
    instances: createInstanceEndpoints(client),
    clusters: createClusterEndpoints(client),
    users: createUserEndpoints(client),
    organizations: createOrganizationEndpoints(client),
  };
}

export type {
  ApplicationEndpoints,
  AuthEndpoints,
  ClusterEndpoints,
  InstanceEndpoints,
  OrganizationEndpoints,
  ServiceEndpoints,
  UserEndpoints,
};
export {
  createAddonsManagerApi,
  createMarketplaceApi,
  type AddonsManagerEndpoints,
  type MarketplaceEndpoints,
  type RemoveAddonResult,
} from './addons.ts';
export {
  createAddonsClient,
  type AddonsClient,
  type AddonsClientOptions,
  type AddonsRequest,
  type AddonsResponse,
} from './addons-client.ts';
export type { PasswordResetRequest } from './auth.ts';
export type { RequestOptions } from './request.ts';
