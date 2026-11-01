import type { ClusterContext, ServiceContext, ApplicationContext } from '@oakestra/dashboard-sdk';
import { useAddonBasePath } from '@oakestra/dashboard-sdk';
import { Link } from 'react-router';

export function HelloWidget() {
  const basePath = useAddonBasePath();
  return (
    <p className="text-sm" data-testid="example-hello-widget">
      The example addon is active.{' '}
      <Link className="underline" to={basePath}>
        Open it
      </Link>
      .
    </p>
  );
}

/** localStorage flag used by the e2e suite to prove a crashing contribution stays contained. */
export const THROW_FLAG = 'oakestra.example.throw';

export function ThrowingWidget() {
  if (window.localStorage.getItem(THROW_FLAG) === '1') {
    throw new Error('Example addon widget crashed on purpose');
  }
  return (
    <p className="text-sm">Set localStorage "{THROW_FLAG}" to "1" to make this widget crash.</p>
  );
}

export function ApplicationTab({ applicationId }: ApplicationContext) {
  return <p className="text-sm">Example tab for application {applicationId}</p>;
}

export function ServiceTab({ applicationId, serviceId }: ServiceContext) {
  return (
    <p className="text-sm">
      Example tab for service {serviceId} of application {applicationId}
    </p>
  );
}

export function ClusterWidget({ clusterId }: ClusterContext) {
  return <p className="text-sm">Example widget for cluster {clusterId}</p>;
}
