import type { SlaV2 } from '@oakestra/api';
import { http } from '@oakestra/mocks';
import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { mockServer, mockStore, TEST_API_URL } from '../../../test/msw';
import { renderApp } from '../../../test/render';
import { applicationKeys, applicationsModule } from '../../applications';

const APP_ID = '6ae75bea77578493c2f80307';
const FRONTEND_ID = '6ae75bea77578493c2f80308';
const newRoute = `/applications/${APP_ID}/services/new`;

function renderNew() {
  return renderApp({ modules: [applicationsModule], route: newRoute });
}

/** Records the SLA body of POST /service/ and lets the mock backend answer as usual. */
function captureCreateBody() {
  const captured: { sla?: SlaV2 } = {};
  mockServer.use(
    http.post(`${TEST_API_URL}/service/`, async ({ request }) => {
      captured.sla = (await request.clone().json()) as SlaV2;
      return undefined;
    }),
  );
  return captured;
}

const sentService = (captured: { sla?: SlaV2 }) => captured.sla!.applications[0]!.microservices[0]!;

const rootOrgId = () => mockStore.data.organizations.find((org) => org.name === 'root')!._id;

function slaFile(document: unknown, name = 'sla.json') {
  return new File([JSON.stringify(document)], name, { type: 'application/json' });
}

const microservice = (name: string) => ({
  microservice_name: name,
  microservice_namespace: 'imported',
  virtualization: 'container',
  code: `docker.io/library/${name}:latest`,
  memory: 128,
  vcpus: 2,
  port: '9000:90/tcp',
  environment: ['MODE=prod'],
});

describe('new service page', () => {
  it('creates a service and navigates to it', async () => {
    const { user, router } = renderNew();
    const before = mockStore.data.services.length;

    await user.type(await screen.findByLabelText('Service name'), 'worker');
    await user.type(screen.getByLabelText('Image or code URL'), 'docker.io/library/busybox');
    await user.click(screen.getByRole('button', { name: 'Add variable' }));
    await user.type(screen.getByLabelText('Variable name 1'), 'MODE');
    await user.type(screen.getByLabelText('Variable value 1'), 'prod');
    await user.click(screen.getByRole('button', { name: 'Create service' }));

    await waitFor(() => expect(mockStore.data.services).toHaveLength(before + 1));
    const created = mockStore.data.services.at(-1)!;
    expect(created).toMatchObject({
      microservice_name: 'worker',
      microservice_namespace: 'default',
      applicationID: APP_ID,
    });
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(
        `/applications/${APP_ID}/services/${created._id}`,
      ),
    );
  });

  it('shows inline validation errors and sends nothing', async () => {
    const { user } = renderNew();
    const before = mockStore.data.services.length;

    await user.type(await screen.findByLabelText('Service name'), 'not valid!');
    await user.click(screen.getByRole('button', { name: 'Create service' }));

    expect(await screen.findByText('Use 1 to 32 letters or digits')).toBeVisible();
    expect(screen.getByText('Enter an image or code URL')).toBeVisible();
    expect(mockStore.data.services).toHaveLength(before);
  });

  it('adds a latency constraint and sends it in the SLA body', async () => {
    const { user } = renderNew();
    await user.type(await screen.findByLabelText('Service name'), 'edge');
    await user.type(screen.getByLabelText('Image or code URL'), 'nginx');
    await user.click(screen.getByRole('button', { name: 'Toggle Constraints' }));
    await user.click(screen.getByRole('button', { name: 'Add latency constraint' }));

    await user.click(screen.getByRole('button', { name: 'Create service' }));
    expect(await screen.findByText('Enter an area, for example munich-1')).toBeVisible();

    await user.type(screen.getByLabelText('Area'), 'munich-1');
    await user.type(screen.getByLabelText('Maximum latency (ms)'), '25');
    await user.click(screen.getByRole('button', { name: 'Create service' }));

    await waitFor(() =>
      expect(mockStore.data.services.some((s) => s.microservice_name === 'edge')).toBe(true),
    );
    const created = mockStore.data.services.find((s) => s.microservice_name === 'edge')!;
    expect(created.constraints).toEqual([
      { type: 'latency', area: 'munich-1', threshold: 25, rigidness: 0.9, convergence_time: 300 },
    ]);
  });

  it('fills the form from a v2 SLA file', async () => {
    const { user } = renderNew();
    const input = await screen.findByLabelText('SLA JSON file');

    await user.upload(
      input,
      slaFile({
        sla_version: 'v2.0',
        customerID: rootOrgId(),
        applications: [
          {
            applicationID: APP_ID,
            application_name: 'webshop',
            application_namespace: 'shop',
            microservices: [microservice('imp')],
          },
        ],
      }),
    );

    await waitFor(() => expect(screen.getByLabelText('Service name')).toHaveValue('imp'));
    expect(screen.getByLabelText('Namespace')).toHaveValue('imported');
    expect(screen.getByLabelText('Memory (MB)')).toHaveValue('128');
    expect(screen.getByLabelText('Host port 1')).toHaveValue('9000');
    expect(screen.getByLabelText('Variable name 1')).toHaveValue('MODE');
  });

  it('fills the form from a legacy microservices file', async () => {
    const { user } = renderNew();
    await user.upload(
      await screen.findByLabelText('SLA JSON file'),
      slaFile({ microservices: [microservice('legacy')] }),
    );

    await waitFor(() => expect(screen.getByLabelText('Service name')).toHaveValue('legacy'));
    expect(screen.getByText(/Legacy SLA format/)).toBeVisible();
  });

  it('accepts a file for another customer or application and warns where it will go', async () => {
    const { user } = renderNew();
    const captured = captureCreateBody();
    const input = await screen.findByLabelText('SLA JSON file');

    await user.upload(
      input,
      slaFile({
        sla_version: 'v2.0',
        customerID: 'someoneelse',
        applications: [
          {
            applicationID: 'otherapp',
            application_name: 'webshop',
            application_namespace: 'shop',
            microservices: [microservice('imp')],
          },
        ],
      }),
    );

    expect(await screen.findByText(/made for customer "someoneelse"/)).toBeVisible();
    expect(screen.getByText(/made for application "otherapp"/)).toBeVisible();
    await waitFor(() => expect(screen.getByLabelText('Service name')).toHaveValue('imp'));

    await user.click(screen.getByRole('button', { name: 'Create service' }));
    await waitFor(() => expect(captured.sla).toBeDefined());
    expect(captured.sla!.customerID).toBe(rootOrgId());
    expect(captured.sla!.applications[0]!.applicationID).toBe(APP_ID);
  });

  it('lets the user create every service of a multi-service file', async () => {
    const { user } = renderNew();
    const before = mockStore.data.services.length;
    await user.upload(
      await screen.findByLabelText('SLA JSON file'),
      slaFile({
        sla_version: 'v2.0',
        customerID: rootOrgId(),
        applications: [
          {
            application_name: 'webshop',
            application_namespace: 'shop',
            microservices: [microservice('one'), microservice('two')],
          },
        ],
      }),
    );

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('This file contains 2 services')).toBeVisible();
    await user.click(within(dialog).getByRole('button', { name: 'Create all 2 services' }));

    await waitFor(() => expect(mockStore.data.services).toHaveLength(before + 2));
  });

  it('loads one service of a multi-service file into the form', async () => {
    const { user } = renderNew();
    await user.upload(
      await screen.findByLabelText('SLA JSON file'),
      slaFile({ microservices: [microservice('one'), microservice('two')] }),
    );
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Load two into the form' }));

    await waitFor(() => expect(screen.getByLabelText('Service name')).toHaveValue('two'));
  });
});

describe('creating services', () => {
  async function fillBasics(user: ReturnType<typeof renderNew>['user'], name: string) {
    await user.type(await screen.findByLabelText('Service name'), name);
    await user.type(screen.getByLabelText('Image or code URL'), 'registry/unikernel.tar.gz');
  }

  it('requires an architecture for unikernels and sends it', async () => {
    const { user } = renderNew();
    const captured = captureCreateBody();
    await fillBasics(user, 'uk');
    expect(screen.queryByRole('group', { name: 'Architecture' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('radio', { name: 'Unikernel' }));
    await user.click(screen.getByRole('button', { name: 'Create service' }));
    expect(await screen.findByText('Select at least one architecture')).toBeVisible();
    expect(captured.sla).toBeUndefined();

    await user.click(screen.getByRole('checkbox', { name: 'amd64' }));
    await user.click(screen.getByRole('button', { name: 'Create service' }));

    await waitFor(() => expect(captured.sla).toBeDefined());
    expect(sentService(captured)).toMatchObject({ virtualization: 'unikernel', arch: ['amd64'] });
  });

  it('does not send an architecture for containers', async () => {
    const { user } = renderNew();
    const captured = captureCreateBody();
    await fillBasics(user, 'plain');
    await user.click(screen.getByRole('button', { name: 'Create service' }));

    await waitFor(() => expect(captured.sla).toBeDefined());
    expect(sentService(captured)).not.toHaveProperty('arch');
  });

  it('shows why the backend refused the only service', async () => {
    mockStore.data.services.find((s) => s._id === FRONTEND_ID)!.addresses = { rr_ip: '10.30.0.5' };
    const { user, router } = renderNew();
    const before = mockStore.data.services.length;
    await fillBasics(user, 'clash');
    await user.click(screen.getByRole('button', { name: 'Toggle Addresses' }));
    await user.type(screen.getByLabelText('Round-robin IP (IPv4)'), '10.30.0.5');
    await user.click(screen.getByRole('button', { name: 'Create service' }));

    expect(await screen.findByText(/Could not create the service\. clash:/)).toBeVisible();
    expect(
      screen.getByText(/clash: failed to deploy service: Service IP 10\.30\.0\.5/),
    ).toBeVisible();
    expect(mockStore.data.services).toHaveLength(before);
    expect(router.state.location.pathname).toBe(newRoute);
  });

  it('keeps going when only some services of a file are refused', async () => {
    mockStore.data.services.find((s) => s._id === FRONTEND_ID)!.addresses = { rr_ip: '10.30.0.5' };
    const { user, router } = renderNew();
    const before = mockStore.data.services.length;
    const withIp = (name: string, rrIp: string) => ({
      ...microservice(name),
      addresses: { rr_ip: rrIp },
    });
    await user.upload(
      await screen.findByLabelText('SLA JSON file'),
      slaFile({
        sla_version: 'v2.0',
        customerID: rootOrgId(),
        applications: [
          {
            application_name: 'webshop',
            application_namespace: 'shop',
            microservices: [withIp('fine', '10.30.0.6'), withIp('taken', '10.30.0.5')],
          },
        ],
      }),
    );
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Create all 2 services' }));

    await waitFor(() => expect(mockStore.data.services).toHaveLength(before + 1));
    expect(mockStore.data.services.at(-1)).toMatchObject({ microservice_name: 'fine' });
    // job_id points at the refused (rolled back) service, so the app page is the safe landing.
    await waitFor(() => expect(router.state.location.pathname).toBe(`/applications/${APP_ID}`));
  });

  it('refreshes the application, which lists the new service ids', async () => {
    const { user, services } = renderNew();
    await fillBasics(user, 'listed');
    const before = services.queryClient.getQueryState(
      applicationKeys.detail(APP_ID),
    )?.dataUpdatedAt;
    await user.click(screen.getByRole('button', { name: 'Create service' }));

    await waitFor(() => {
      const after = services.queryClient.getQueryState(applicationKeys.detail(APP_ID));
      expect(after?.dataUpdatedAt).not.toBe(before);
    });
    const application = mockStore.data.applications.find((a) => a._id === APP_ID)!;
    expect(application.microservices).toContain(mockStore.data.services.at(-1)!._id);
  });
});

describe('duplicate service page', () => {
  it('prefills the form from the existing service', async () => {
    renderApp({
      modules: [applicationsModule],
      route: `/applications/${APP_ID}/services/${FRONTEND_ID}/duplicate`,
    });

    expect(await screen.findByLabelText('Service name')).toHaveValue('frontendcopy');
    expect(screen.getByLabelText('Namespace')).toHaveValue('shop');
    expect(screen.getByLabelText('Image or code URL')).toHaveValue(
      'docker.io/library/nginx:alpine',
    );
    expect(screen.getByRole('radio', { name: 'Container' })).toBeChecked();
    expect(screen.getByLabelText('Host port 1')).toHaveValue('8081');
    expect(screen.getByLabelText('Container port 1')).toHaveValue('80');
    expect(screen.getByLabelText('Memory (MB)')).toHaveValue('64');
  });

  it('creates the copy as a new service', async () => {
    const { user } = renderApp({
      modules: [applicationsModule],
      route: `/applications/${APP_ID}/services/${FRONTEND_ID}/duplicate`,
    });
    const before = mockStore.data.services.length;
    const captured = captureCreateBody();
    await screen.findByDisplayValue('frontendcopy');
    await user.click(screen.getByRole('button', { name: 'Create service' }));

    await waitFor(() => expect(mockStore.data.services).toHaveLength(before + 1));
    expect(sentService(captured)).toMatchObject({
      microservice_name: 'frontendcopy',
      microservice_namespace: 'shop',
      port: '8081:80/tcp',
    });
    // Runtime state of the original must not be part of the request.
    for (const key of ['instance_list', 'status', '_id', 'microserviceID', 'job_name', 'image']) {
      expect(sentService(captured)).not.toHaveProperty(key);
    }
    expect(mockStore.data.services.at(-1)!.instance_list).toEqual([]);
  });

  it('creates the copy of a service with a round-robin IP without that IP', async () => {
    const original = mockStore.data.services.find((s) => s._id === FRONTEND_ID)!;
    original.addresses = { rr_ip: '10.30.0.5', RR_ip: '10.30.0.5', closest_ip: '10.30.1.1' };
    original.RR_ip = '10.30.0.5';
    const { user } = renderApp({
      modules: [applicationsModule],
      route: `/applications/${APP_ID}/services/${FRONTEND_ID}/duplicate`,
    });
    const before = mockStore.data.services.length;
    const captured = captureCreateBody();
    await screen.findByDisplayValue('frontendcopy');
    expect(screen.getByLabelText('Round-robin IP (IPv4)')).toHaveValue('');
    await user.click(screen.getByRole('button', { name: 'Create service' }));

    await waitFor(() => expect(mockStore.data.services).toHaveLength(before + 1));
    expect(sentService(captured).addresses).toEqual({ closest_ip: '10.30.1.1' });
  });
});
