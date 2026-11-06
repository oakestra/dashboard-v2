import type { Instance } from '@oakestra/api';
import {
  DropdownMenuItem,
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemTitle,
  formatBytes,
  formatPercent,
  stretchedLinkClassName,
  RowMenu,
} from '@oakestra/ui';
import { ExternalLinkIcon, SquareIcon } from 'lucide-react';
import { Link } from 'react-router';

import { hasMetrics, instanceHost, instanceProblem } from '../status';
import { StatusBadge } from './StatusBadge';

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="w-20 sm:text-right">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm tabular-nums">{value}</dd>
    </div>
  );
}

export function InstanceItem({
  instance,
  clusterName,
  href,
  onUndeploy,
}: {
  instance: Instance;
  clusterName: string | undefined;
  href: string;
  onUndeploy: () => void;
}) {
  const problem = instanceProblem(instance);
  const host = instanceHost(instance);
  const metrics = hasMetrics(instance);
  return (
    <Item>
      <ItemContent className="basis-64">
        <ItemTitle>
          <Link
            aria-label={`Open instance ${instance.instance_number}`}
            className={`tabular-nums ${stretchedLinkClassName}`}
            to={href}
          >
            Instance {instance.instance_number}
          </Link>
          {/* Above the stretched link: the badge's title is the only place with the raw status. */}
          <span className="relative z-10 flex">
            <StatusBadge status={instance.status} detail={problem} />
          </span>
        </ItemTitle>
        {problem ? <ItemDescription className="text-xs">{problem}</ItemDescription> : null}
        <div className="flex flex-wrap gap-x-3 text-xs text-muted-foreground">
          <span>{clusterName ?? 'No cluster'}</span>
          {host ? <span className="font-mono">{host}</span> : null}
          {instance.publicip ? <span className="font-mono">{instance.publicip}</span> : null}
        </div>
      </ItemContent>
      <dl className="flex gap-4">
        <Metric label="CPU" value={metrics ? formatPercent(instance.cpu_percent) : '-'} />
        <Metric label="Memory" value={metrics ? formatBytes(instance.memory_percent) : '-'} />
      </dl>
      <ItemActions className="ml-auto">
        <RowMenu label={`Actions for instance ${instance.instance_number}`}>
          <DropdownMenuItem asChild>
            <Link to={href}>
              <ExternalLinkIcon aria-hidden /> Open
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem variant="destructive" onSelect={onUndeploy}>
            <SquareIcon aria-hidden /> Undeploy
          </DropdownMenuItem>
        </RowMenu>
      </ItemActions>
    </Item>
  );
}
