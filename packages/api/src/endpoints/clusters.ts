import type { OakestraClient } from '../client.ts';
import { clusterSchema, type Cluster } from '../models/cluster.ts';
import { lenientArray } from '../models/common.ts';
import { parse, send, type RequestOptions } from './request.ts';

const clusterList = lenientArray(clusterSchema, 'clusters');

export interface ClusterEndpoints {
  list(options?: RequestOptions): Promise<Cluster[]>;
  /** Clusters that reported in recently. */
  listActive(options?: RequestOptions): Promise<Cluster[]>;
}

export function createClusterEndpoints(client: OakestraClient): ClusterEndpoints {
  return {
    async list(options) {
      const call = { method: 'GET', path: '/clusters/' };
      const data = await send(call, () => client.GET('/clusters/', { ...options }));
      return parse(clusterList, data, call);
    },
    async listActive(options) {
      const call = { method: 'GET', path: '/clusters/active' };
      const data = await send(call, () => client.GET('/clusters/active', { ...options }));
      return parse(clusterList, data, call);
    },
  };
}
