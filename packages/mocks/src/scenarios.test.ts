import { clusterSchema, serviceSchema } from '@oakestra/api';
import { describe, expect, it } from 'vitest';

import { withPlacementDemo } from './scenarios.ts';
import { createMockStore } from './store.ts';

const clusterNames = (store: ReturnType<typeof createMockStore>) =>
  store.data.clusters.map((cluster) => cluster.cluster_name);

describe('withPlacementDemo', () => {
  it('leaves the plain seed untouched', () => {
    expect(clusterNames(createMockStore())).not.toContain('edge-wien');
  });

  it('produces clusters and services the api models accept', () => {
    const { data } = createMockStore(withPlacementDemo);
    expect(data.clusters.map((cluster) => clusterSchema.parse(cluster).cluster_name)).toEqual(
      expect.arrayContaining(['plant-leipzig', 'edge-hamburg', 'edge-wien', 'edge-munich']),
    );
    for (const service of data.services) serviceSchema.parse(service);
  });

  it('keeps ids unique and references consistent', () => {
    const { data } = createMockStore(withPlacementDemo);
    const clusterIds = data.clusters.map((cluster) => cluster._id);
    const serviceIds = data.services.map((service) => service._id);
    expect(new Set(clusterIds).size).toBe(clusterIds.length);
    expect(new Set(serviceIds).size).toBe(serviceIds.length);

    for (const service of data.services) {
      for (const instance of service.instance_list) {
        expect(clusterIds).toContain(instance.cluster_id);
      }
      const app = data.applications.find((a) => a.applicationID === service.applicationID);
      expect(app?.microservices).toContain(service._id);
    }
    for (const app of data.applications) {
      expect(app.application_name.length).toBeLessThanOrEqual(10);
      for (const id of app.microservices) expect(serviceIds).toContain(id);
    }
  });

  it('makes edge-munich silent with last-known values and the others fresh', () => {
    const { data } = createMockStore(withPlacementDemo);
    const byName = (name: string) =>
      clusterSchema.parse(data.clusters.find((cluster) => cluster.cluster_name === name));
    const munich = byName('edge-munich');
    expect(munich.active).toBe(false);
    expect(munich.cpu_percent).toBeGreaterThan(0);
    expect(munich.active_nodes).toBeGreaterThan(0);
    expect(Date.now() - munich.last_modified_timestamp!.getTime()).toBeGreaterThan(3 * 86_400_000);

    for (const name of ['test-cluster', 'plant-leipzig', 'edge-hamburg', 'edge-wien']) {
      const fresh = byName(name);
      expect(fresh.active).toBe(true);
      expect(Date.now() - fresh.last_modified_timestamp!.getTime()).toBeLessThan(5_000);
    }
  });

  it('gives each placement failure a status and the silent cluster a pinned service', () => {
    const { data } = createMockStore(withPlacementDemo);
    const status = (name: string) =>
      data.services.find((service) => service.microservice_name === name)?.status;
    expect(status('bigmem')).toBe('NoActiveClusterWithCapacity');
    expect(status('wideload')).toBe('NO_WORKER_CAPACITY');
    expect(status('munichgw')).toBe('TargetClusterNotActive');
    const owner = (name: string) => {
      const service = data.services.find((s) => s.microservice_name === name);
      return data.applications.find((a) => a.applicationID === service?.applicationID)?.userId;
    };
    expect(owner('bigmem')).toBe('Admin');
    expect(owner('warehouse')).toBe('alice');
  });

  it('is reapplied by reset()', () => {
    const store = createMockStore(withPlacementDemo);
    store.data.clusters = [];
    store.data.services = [];
    store.reset();
    expect(clusterNames(store)).toContain('edge-wien');
    expect(store.data.services.some((service) => service.microservice_name === 'bigmem')).toBe(
      true,
    );
  });
});
