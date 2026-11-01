import type { OakestraClient } from '../client.ts';
import { lenientArray } from '../models/common.ts';
import {
  serviceCreateResultSchema,
  serviceSchema,
  type Service,
  type ServiceCreateResult,
} from '../models/service.ts';
import type { SlaV2 } from '../models/sla.ts';
import { body, parse, send, type RequestOptions } from './request.ts';

const serviceList = lenientArray(serviceSchema, 'services');

export interface ServiceEndpoints {
  /** Every service of every user. Admin only. */
  list(options?: RequestOptions): Promise<Service[]>;
  listForApplication(applicationId: string, options?: RequestOptions): Promise<Service[]>;
  get(serviceId: string, options?: RequestOptions): Promise<Service>;
  /** Creates the services listed in the SLA's first application (which must already exist). */
  create(sla: SlaV2): Promise<ServiceCreateResult>;
  /**
   * Current system-managers answer this with 501 "Not implemented". Kept so the dashboard can use
   * it as soon as the backend supports it.
   */
  update(serviceId: string, sla: SlaV2): Promise<void>;
  delete(serviceId: string): Promise<void>;
}

export function createServiceEndpoints(client: OakestraClient): ServiceEndpoints {
  return {
    async list(options) {
      const call = { method: 'GET', path: '/services/' };
      const data = await send(call, () => client.GET('/services/', { ...options }));
      return parse(serviceList, data, call);
    },
    async listForApplication(applicationId, options) {
      const call = { method: 'GET', path: `/services/${applicationId}` };
      const data = await send(call, () =>
        client.GET('/services/{appid}', { params: { path: { appid: applicationId } }, ...options }),
      );
      return parse(serviceList, data, call);
    },
    async get(serviceId, options) {
      const call = { method: 'GET', path: `/service/${serviceId}` };
      const data = await send(call, () =>
        client.GET('/service/{serviceid}', {
          params: { path: { serviceid: serviceId } },
          ...options,
        }),
      );
      return parse(serviceSchema, data, call);
    },
    async create(sla) {
      const call = { method: 'POST', path: '/service/' };
      const data = await send(call, () => client.POST('/service/', { body: body(sla) }));
      return parse(serviceCreateResultSchema, data ?? {}, call);
    },
    async update(serviceId, sla) {
      await send({ method: 'PUT', path: `/service/${serviceId}` }, () =>
        client.PUT('/service/{serviceid}', {
          params: { path: { serviceid: serviceId } },
          body: body(sla),
        }),
      );
    },
    async delete(serviceId) {
      await send({ method: 'DELETE', path: `/service/${serviceId}` }, () =>
        client.DELETE('/service/{serviceid}', { params: { path: { serviceid: serviceId } } }),
      );
    },
  };
}
