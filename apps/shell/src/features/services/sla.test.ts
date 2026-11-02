import type { Service } from '@oakestra/api';
import { describe, expect, it } from 'vitest';

import { serviceToSla } from './sla';

const stored = {
  _id: 's1',
  microserviceID: 's1',
  applicationID: 'app1',
  app_name: 'shop',
  app_ns: 'default',
  microservice_name: 'frontend',
  microservice_namespace: 'shop',
  virtualization: 'unikernel',
  arch: ['amd64'],
  code: 'x',
  status: 'RUNNING',
  instance_list: [{ instance_number: 0 }],
  RR_ip: '10.30.0.5',
  addresses: {
    rr_ip: '10.30.0.5',
    RR_ip: '10.30.0.5',
    rr_ip_v6: 'fdff::5',
    closest_ip: '10.30.1.1',
  },
} as unknown as Service;

describe('serviceToSla', () => {
  it('rebuilds an importable SLA without runtime state or the allocated round-robin IPs', () => {
    const sla = serviceToSla(stored, 'org1');
    const microservice = sla.applications[0]!.microservices[0]!;

    expect(microservice).toMatchObject({ microservice_name: 'frontend', arch: ['amd64'] });
    expect(microservice).not.toHaveProperty('instance_list');
    expect(microservice).not.toHaveProperty('microserviceID');
    expect(microservice.addresses).toEqual({ closest_ip: '10.30.1.1' });
    expect(JSON.stringify(sla)).not.toMatch(/10\.30\.0\.5|fdff::5/);
  });

  it('leaves out addresses a service never had', () => {
    const { addresses: _addresses, ...bare } = stored as unknown as Record<string, unknown>;
    const microservice = serviceToSla(bare as unknown as Service, 'org1').applications[0]!
      .microservices[0]!;
    expect(microservice).not.toHaveProperty('addresses');
  });
});
