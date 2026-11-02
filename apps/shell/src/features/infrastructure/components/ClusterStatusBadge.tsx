import { StatusBadge } from '@oakestra/ui';

import { clusterTone } from '../lib';

export function ClusterStatusBadge({ active }: { active: boolean }) {
  return (
    <StatusBadge tone={clusterTone(active)} data-status={active ? 'active' : 'inactive'}>
      {active ? 'Active' : 'Inactive'}
    </StatusBadge>
  );
}
