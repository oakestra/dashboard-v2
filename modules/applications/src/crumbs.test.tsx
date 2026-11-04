import { ApiError } from '@oakestra/api';
import { renderInHost } from '@oakestra/dashboard-sdk/testing';
import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ApplicationCrumb, InstanceCrumb, ServiceCrumb } from './crumbs';

const notFound = () =>
  Promise.reject(
    new ApiError('Not found', { kind: 'http', status: 404, method: 'GET', path: '/x', body: null }),
  );

describe('crumbs', () => {
  it('names the application in the URL', async () => {
    renderInHost(<ApplicationCrumb params={{ appId: 'a1' }} />, {
      api: {
        applications: {
          get: (id: string) => Promise.resolve({ _id: id, application_name: 'webshop' } as never),
        },
      },
    });

    expect(await screen.findByText('webshop')).toBeVisible();
  });

  it('falls back to a generic label for an unknown application', async () => {
    renderInHost(<ApplicationCrumb params={{ appId: 'zz' }} />, {
      api: { applications: { get: notFound } },
    });

    expect(await screen.findByText('Application')).toBeVisible();
  });

  it('names the service in the URL', async () => {
    renderInHost(<ServiceCrumb params={{ serviceId: 's1' }} />, {
      api: {
        services: {
          get: (id: string) => Promise.resolve({ _id: id, microservice_name: 'frontend' } as never),
        },
      },
    });

    expect(await screen.findByText('frontend')).toBeVisible();
  });

  it('numbers the instance from the URL without fetching', () => {
    renderInHost(<InstanceCrumb params={{ instanceNumber: '2' }} />);

    expect(screen.getByText('Instance 2')).toBeVisible();
  });
});
