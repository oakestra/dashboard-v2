import type { OakestraClient } from '../client.ts';
import { lenientArray } from '../models/common.ts';
import {
  organizationSchema,
  type Organization,
  type OrganizationInput,
} from '../models/organization.ts';
import { body, parse, send, type RequestOptions } from './request.ts';

const organizationList = lenientArray(organizationSchema, 'organizations');

/** All organization endpoints are Admin only. */
export interface OrganizationEndpoints {
  list(options?: RequestOptions): Promise<Organization[]>;
  create(organization: OrganizationInput): Promise<Organization>;
  /** Replaces name and member list. */
  update(organizationId: string, organization: OrganizationInput): Promise<void>;
  delete(organizationId: string): Promise<void>;
}

export function createOrganizationEndpoints(client: OakestraClient): OrganizationEndpoints {
  return {
    async list(options) {
      const call = { method: 'GET', path: '/organization/' };
      const data = await send(call, () => client.GET('/organization/', { ...options }));
      return parse(organizationList, data, call);
    },
    async create(organization) {
      const call = { method: 'POST', path: '/organization/' };
      const data = await send(call, () =>
        client.POST('/organization/', { body: body(organization) }),
      );
      return parse(organizationSchema, data, call);
    },
    async update(organizationId, organization) {
      await send({ method: 'PUT', path: `/organization/${organizationId}` }, () =>
        client.PUT('/organization/{organizationid}', {
          params: { path: { organizationid: organizationId } },
          body: body(organization),
        }),
      );
    },
    async delete(organizationId) {
      await send({ method: 'DELETE', path: `/organization/${organizationId}` }, () =>
        client.DELETE('/organization/{organizationid}', {
          params: { path: { organizationid: organizationId } },
        }),
      );
    },
  };
}
