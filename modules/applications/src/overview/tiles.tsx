import { useAddonPath } from '@oakestra/dashboard-sdk';
import { StatCard, plural } from '@oakestra/ui';
import { ActivityIcon, BoxesIcon, BoxIcon } from 'lucide-react';
import { Link } from 'react-router';

import { useOverviewData } from './data';

// Overview tiles (`home.widgets`, size `stat`). Every tile opens the applications list: services
// and instances have no list of their own outside an application. On a load error they stop
// loading and show what they have; the recent applications section explains the error.

export function ApplicationsTile() {
  const addonPath = useAddonPath();
  const { applications, services, applicationsLoading, error } = useOverviewData();
  return (
    <StatCard
      asChild
      label="Applications"
      value={applications.length}
      icon={<BoxesIcon />}
      hint={plural(services.length, 'service')}
      loading={applicationsLoading && !error}
    >
      <Link to={addonPath()} />
    </StatCard>
  );
}

export function ServicesTile() {
  const addonPath = useAddonPath();
  const { services, attention, servicesLoading, error } = useOverviewData();
  const undeployed = attention.filter((item) => item.tone === 'neutral').length;
  const problems = attention.filter(
    (item) => item.tone === 'destructive' || item.tone === 'warning',
  );
  return (
    <StatCard
      asChild
      label="Services"
      value={services.length}
      icon={<BoxIcon />}
      tone={
        problems.some((item) => item.tone === 'destructive')
          ? 'destructive'
          : problems.length > 0
            ? 'warning'
            : 'default'
      }
      hint={
        problems.length > 0
          ? `${problems.length} need${problems.length === 1 ? 's' : ''} attention`
          : undeployed > 0
            ? `${undeployed} not deployed`
            : services.length === 0
              ? 'No services yet'
              : 'All deployed'
      }
      loading={servicesLoading && !error}
    >
      <Link to={addonPath()} />
    </StatCard>
  );
}

export function InstancesTile() {
  const addonPath = useAddonPath();
  const { instances, servicesLoading, error } = useOverviewData();
  const hint =
    instances.total === 0
      ? 'No instances yet'
      : instances.failed + instances.pending > 0
        ? [
            instances.pending > 0 ? `${instances.pending} pending` : null,
            instances.failed > 0 ? `${instances.failed} failed` : null,
          ]
            .filter(Boolean)
            .join(', ')
        : 'All running';
  return (
    <StatCard
      asChild
      label="Instances"
      value={`${instances.running}/${instances.total}`}
      icon={<ActivityIcon />}
      tone={instances.failed > 0 ? 'destructive' : instances.pending > 0 ? 'info' : 'default'}
      hint={hint}
      loading={servicesLoading && !error}
    >
      <Link to={addonPath()} />
    </StatCard>
  );
}
