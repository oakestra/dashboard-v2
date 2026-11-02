import { z } from 'zod';

import type { OakestraClient } from '../client.ts';
import {
  applicationSchema,
  type Application,
  type ApplicationUpdate,
} from '../models/application.ts';
import { lenientArray } from '../models/common.ts';
import type { SlaV2 } from '../models/sla.ts';
import { body, parse, send, type RequestOptions } from './request.ts';

const applicationList = lenientArray(applicationSchema, 'applications');

export interface ApplicationEndpoints {
  /** Every application of every user. Admin only. */
  list(options?: RequestOptions): Promise<Application[]>;
  /**
   * Applications of the current user. `userId` is the user's `_id`, not the username; anything but
   * the caller's own id is answered with 401.
   */
  listForUser(userId: string, options?: RequestOptions): Promise<Application[]>;
  get(applicationId: string, options?: RequestOptions): Promise<Application>;
  /** Creates the application(s) described by the SLA. Returns all applications of the user. */
  create(sla: SlaV2): Promise<Application[]>;
  update(applicationId: string, update: ApplicationUpdate): Promise<void>;
  /** Also deletes the application's services. */
  delete(applicationId: string): Promise<void>;
}

export function createApplicationEndpoints(client: OakestraClient): ApplicationEndpoints {
  return {
    async list(options) {
      const call = { method: 'GET', path: '/applications/' };
      const data = await send(call, () => client.GET('/applications/', { ...options }));
      return parse(applicationList, data, call);
    },
    async listForUser(userId, options) {
      const call = { method: 'GET', path: `/applications/${userId}` };
      const data = await send(call, () =>
        client.GET('/applications/{userid}', { params: { path: { userid: userId } }, ...options }),
      );
      return parse(applicationList, data, call);
    },
    async get(applicationId, options) {
      const call = { method: 'GET', path: `/application/${applicationId}` };
      const data = await send(call, () =>
        client.GET('/application/{appid}', {
          params: { path: { appid: applicationId } },
          ...options,
        }),
      );
      return parse(applicationSchema, data, call);
    },
    async create(sla) {
      const call = { method: 'POST', path: '/application/' };
      const data = await send(call, () => client.POST('/application/', { body: body(sla) }));
      return parse(
        z.union([applicationList, applicationSchema.transform((app) => [app])]),
        data,
        call,
      );
    },
    async update(applicationId, update) {
      await send({ method: 'PUT', path: `/application/${applicationId}` }, () =>
        client.PUT('/application/{appid}', {
          params: { path: { appid: applicationId } },
          body: body(update),
        }),
      );
    },
    async delete(applicationId) {
      await send({ method: 'DELETE', path: `/application/${applicationId}` }, () =>
        client.DELETE('/application/{appid}', { params: { path: { appid: applicationId } } }),
      );
    },
  };
}
