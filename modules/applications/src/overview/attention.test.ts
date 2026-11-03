import type { Application, Service } from '@oakestra/api';
import { describe, expect, it } from 'vitest';

import { attentionItems } from './attention';

const application = { _id: 'a1', application_name: 'shop' } as Application;

function service(id: string, status: string | undefined, instances: string[] = []): Service {
  return {
    _id: id,
    microservice_name: id,
    status,
    instance_list: instances.map((instanceStatus, index) => ({
      instance_number: index,
      status: instanceStatus,
    })),
  } as unknown as Service;
}

function keys(services: Service[]) {
  return attentionItems([{ application, services }]).map((item) => item.key);
}

describe('attentionItems', () => {
  it('lists nothing for healthy and scheduling services', () => {
    expect(keys([service('ok', 'RUNNING', ['RUNNING']), service('wait', 'REQUESTED')])).toEqual([]);
  });

  it('orders failures before capacity problems before undeployed services', () => {
    const items = attentionItems([
      {
        application,
        services: [
          service('idle', undefined),
          service('nocap', 'NoActiveClusterWithCapacity'),
          service('dead', 'FAILED'),
        ],
      },
    ]);
    expect(items.map((item) => [item.key, item.tone])).toEqual([
      ['dead', 'destructive'],
      ['nocap', 'warning'],
      ['idle', 'neutral'],
    ]);
  });

  it('flags a running service with a failed instance', () => {
    const [item] = attentionItems([
      { application, services: [service('s', 'RUNNING', ['RUNNING', 'FAILED'])] },
    ]);
    expect(item).toMatchObject({
      tone: 'destructive',
      status: 'FAILED',
      note: '1 of 2 instances failing',
    });
  });
});
