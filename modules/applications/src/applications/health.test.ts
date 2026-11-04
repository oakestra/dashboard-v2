import type { Service } from '@oakestra/api';
import { describe, expect, it } from 'vitest';

import { applicationHealth, describeServiceCounts } from './health';

function service(status: string | undefined, instances: string[] = []): Service {
  return {
    _id: 's',
    microservice_name: 's',
    microservice_namespace: 'default',
    status,
    instance_list: instances.map((instanceStatus, index) => ({
      instance_number: index,
      status: instanceStatus,
    })),
  } as unknown as Service;
}

describe('applicationHealth', () => {
  it('is empty without services', () => {
    expect(applicationHealth([])).toMatchObject({ tone: 'neutral', label: 'Empty' });
  });

  it('is not deployed when no service has an instance', () => {
    const health = applicationHealth([service(undefined), service(undefined)]);
    expect(health).toMatchObject({ tone: 'neutral', label: 'Not deployed', undeployed: 2 });
  });

  it('is healthy when everything runs', () => {
    const health = applicationHealth([service('RUNNING', ['RUNNING', 'RUNNING'])]);
    expect(health).toMatchObject({ tone: 'success', label: 'Healthy' });
    expect(describeServiceCounts(health)).toBe('1 service, 2/2 running');
  });

  it('stays healthy next to an undeployed service but counts it', () => {
    const health = applicationHealth([service('RUNNING', ['RUNNING']), service(undefined)]);
    expect(health).toMatchObject({ tone: 'success', undeployed: 1 });
  });

  it('is deploying while the scheduler works', () => {
    expect(applicationHealth([service('REQUESTED')])).toMatchObject({
      tone: 'info',
      label: 'Deploying',
    });
  });

  it('is degraded when no cluster has capacity', () => {
    expect(applicationHealth([service('NoActiveClusterWithCapacity')])).toMatchObject({
      tone: 'warning',
      label: 'Degraded',
    });
  });

  it('is failing when an instance crashed although the service reads RUNNING', () => {
    const health = applicationHealth([service('RUNNING', ['RUNNING', 'FAILED'])]);
    expect(health).toMatchObject({ tone: 'destructive', label: 'Failing' });
    expect(health.instances.failed).toBe(1);
  });

  it('shows only the service count without instances', () => {
    expect(describeServiceCounts(applicationHealth([service(undefined)]))).toBe('1 service');
  });
});
