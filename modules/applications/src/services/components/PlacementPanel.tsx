import type { Cluster, Service } from '@oakestra/api';
import { clustersQuery, useAddonPath, useOakestraApi } from '@oakestra/dashboard-sdk';
import {
  Badge,
  Button,
  QueryErrorAlert,
  SectionCard,
  Skeleton,
  Slider,
  StatusBadge,
  StatusDot,
  cn,
  formatMegabytes,
} from '@oakestra/ui';
import { useQuery } from '@tanstack/react-query';
import { useId, useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router';

import {
  MEMORY_SLIDER_STEPS,
  describeNotEvaluated,
  describeRowResult,
  describeWhatIf,
  directTarget,
  evaluatePlacement,
  explainPlacement,
  initialLimits,
  limitCeilings,
  limitsCanHelp,
  memoryToPosition,
  placementFailureStatus,
  positionToMemory,
  type CheckedPlacementRow,
  type PlacementLimits,
  type PlacementRow,
} from '../placement';
import { describeStatus } from '../status';
import { PlacementDiagram } from './PlacementDiagram';

interface PlacementPanelProps {
  service: Service;
  appId: string;
  onRetry: () => void;
  retrying: boolean;
}

/**
 * Explains a failed placement cluster by cluster. Rendered by the Overview tab only: the header's
 * status badge and actions already carry the short version on every tab, and a list with sliders
 * above the tabs would push the instances and the JSON out of view.
 */
export function PlacementPanel({ service, appId, onRetry, retrying }: PlacementPanelProps) {
  const api = useOakestraApi();
  const addonPath = useAddonPath();
  // No `select`: the page reads names from the same cache entry, the rows need the whole cluster.
  const clusters = useQuery(clustersQuery(api));
  const rows = useMemo(
    () => (clusters.data ? evaluatePlacement(service, clusters.data) : undefined),
    [service, clusters.data],
  );

  const duplicateTo = addonPath(appId, 'services', service._id, 'duplicate');
  const status = describeStatus(placementFailureStatus(service));
  const { title, detail } = rows
    ? explainPlacement(service, rows)
    : { title: status.label, detail: status.hint };

  return (
    <SectionCard
      data-testid="placement-panel"
      title={
        <span className="flex items-center gap-2">
          <StatusDot tone="warning" />
          {title}
        </span>
      }
      description={detail}
      flush
    >
      {/* Below the text, not in the card's action slot: these labels would squeeze it on a phone. */}
      <div className="flex flex-wrap gap-2 px-4 pb-3">
        <Button size="sm" variant="outline" disabled={retrying} onClick={onRetry}>
          Retry placement
        </Button>
        <Button size="sm" variant="outline" asChild>
          <Link to={duplicateTo}>
            {directTarget(service) === undefined
              ? 'Duplicate with lower requirements'
              : 'Duplicate with another target'}
          </Link>
        </Button>
      </div>
      {clusters.data ? (
        <ClusterChecks
          service={service}
          clusters={clusters.data}
          baseline={rows ?? []}
          duplicateTo={duplicateTo}
        />
      ) : clusters.isError ? (
        <div className="border-t p-4">
          <QueryErrorAlert
            title="Could not load the clusters"
            error={clusters.error}
            onRetry={() => void clusters.refetch()}
          />
        </div>
      ) : (
        <div className="space-y-2 border-t p-4" data-testid="placement-loading">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
        </div>
      )}
    </SectionCard>
  );
}

function ClusterChecks({
  service,
  clusters,
  baseline,
  duplicateTo,
}: {
  service: Service;
  clusters: readonly Cluster[];
  /** The evaluation without any changed limits. */
  baseline: readonly PlacementRow[];
  duplicateTo: string;
}) {
  const [limits, setLimits] = useState(() => initialLimits(service));
  const rows = useMemo(
    () => evaluatePlacement(service, clusters, limits),
    [service, clusters, limits],
  );
  const skipped = describeNotEvaluated(service);
  const canHelp = limitsCanHelp(baseline);

  return (
    <>
      <div className="border-t pt-3">
        <PlacementDiagram service={service} rows={rows} />
        <ClusterList service={service} rows={rows} limits={limits} />
      </div>
      {skipped ? (
        <p className="border-t px-4 py-3 text-sm text-muted-foreground">{skipped}</p>
      ) : null}
      <div className="space-y-4 border-t px-4 py-3.5">
        {canHelp ? (
          <WhatIf
            ceilings={limitCeilings(service, baseline)}
            limits={limits}
            rows={rows}
            onChange={setLimits}
          />
        ) : null}
        <CopyAction
          canHelp={canHelp}
          passes={rows.some((row) => row.state === 'passes')}
          limits={limits}
          duplicateTo={duplicateTo}
        />
        <p className="text-xs text-muted-foreground">
          Estimated from each cluster&apos;s last report, the scheduler decides. A deployed service
          cannot be edited, so limits change through a copy.
        </p>
      </div>
    </>
  );
}

function ClusterList({
  service,
  rows,
  limits,
}: {
  service: Service;
  rows: readonly PlacementRow[];
  limits: PlacementLimits;
}) {
  if (rows.length === 0) {
    return <p className="px-4 py-3 text-sm text-muted-foreground">No clusters are registered.</p>;
  }
  return (
    <>
      <p className="px-4 py-2.5 text-xs text-muted-foreground">
        Closest first. The service needs {limits.vcpus} vCPU in the cluster total,{' '}
        {formatMegabytes(limits.memory)} of free memory and the{' '}
        {service.virtualization ?? 'unknown'} runtime.
      </p>
      <ul
        aria-label="What each cluster offers against what the service requests"
        className="divide-y border-t"
      >
        {rows.map((row) => (
          <li
            key={row.cluster._id}
            data-testid={`placement-row-${row.cluster.cluster_name}`}
            data-placement={row.state}
            className={cn(
              'space-y-2.5 px-4 py-3',
              row.state === 'silent' && 'text-muted-foreground',
            )}
          >
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
              <span className="flex min-w-0 items-center gap-2 text-sm font-medium">
                <span className="truncate">{row.cluster.cluster_name}</span>
                {row.isTarget ? <Badge variant="outline">Target</Badge> : null}
              </span>
              <RowResult row={row} />
            </div>
            {row.state === 'silent' ? (
              <p className="text-xs">
                {row.report === 'silent' ? 'No recent report' : 'Never reported'}
              </p>
            ) : (
              <CheckFacts row={row} limits={limits} />
            )}
          </li>
        ))}
      </ul>
    </>
  );
}

function CheckFacts({ row, limits }: { row: CheckedPlacementRow; limits: PlacementLimits }) {
  return (
    <dl className="grid gap-x-8 gap-y-2 sm:grid-cols-3">
      <Fact label="vCPU">
        <Reach
          offered={row.vcpus}
          wanted={limits.vcpus}
          label={String(row.vcpus)}
          short={row.blockers.includes('vcpus')}
        />
      </Fact>
      <Fact label="Memory">
        <Reach
          offered={row.memory}
          wanted={limits.memory}
          label={formatMegabytes(row.memory)}
          short={row.blockers.includes('memory')}
        />
      </Fact>
      <Fact label="Runtime">
        <span
          className={cn('font-mono text-xs', row.blockers.includes('runtime') && 'text-warning')}
        >
          {row.runtimes.join(', ') || 'None'}
        </span>
      </Fact>
    </dl>
  );
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0 space-y-1">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

/** How far the offer reaches towards the request, whose end is the mark at the right of the track. */
function Reach({
  offered,
  wanted,
  label,
  short,
}: {
  offered: number;
  wanted: number;
  label: string;
  short: boolean;
}) {
  const reach = wanted > 0 ? Math.min(100, (offered / wanted) * 100) : 100;
  return (
    <div className="min-w-28 space-y-1">
      <div aria-hidden className="relative h-1.5 border-r-2 border-foreground/50 bg-foreground/5">
        <div
          className={cn('absolute inset-y-0 left-0', short ? 'bg-warning' : 'bg-foreground/25')}
          style={{ width: `${reach}%` }}
        />
      </div>
      <div className={cn('text-xs tabular-nums', short && 'font-medium text-warning')}>
        {label}
        {short ? ' is short' : null}
      </div>
    </div>
  );
}

function RowResult({ row }: { row: PlacementRow }) {
  const text = describeRowResult(row);
  if (row.state === 'silent') {
    return (
      <StatusBadge tone="neutral" stale>
        {text}
      </StatusBadge>
    );
  }
  // Not being the target says nothing about the cluster, so it does not read as a problem.
  const offTarget = row.blockers.length === 1 && row.blockers[0] === 'target';
  return (
    <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
      {row.missingCsiDrivers.length > 0 ? (
        <span className="font-mono text-xs text-muted-foreground">
          {row.missingCsiDrivers.join(', ')}
        </span>
      ) : null}
      <StatusBadge tone={row.state === 'passes' || offTarget ? 'neutral' : 'warning'}>
        {text}
      </StatusBadge>
    </span>
  );
}

function WhatIf({
  ceilings,
  limits,
  rows,
  onChange,
}: {
  ceilings: PlacementLimits;
  limits: PlacementLimits;
  rows: readonly PlacementRow[];
  onChange: (limits: PlacementLimits) => void;
}) {
  // Kept apart from the limit, because positions round to the same MB at the low end of the log
  // scale: a thumb derived from the limit would snap back, and arrow keys could never get past it.
  const [memoryPosition, setMemoryPosition] = useState(() =>
    memoryToPosition(limits.memory, ceilings.memory),
  );
  const memoryText = formatMegabytes(limits.memory);
  return (
    <>
      <h3 className="text-sm font-semibold">Try other limits</h3>
      <div className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
        <LimitControl label="vCPU" value={String(limits.vcpus)}>
          <Slider
            thumbLabel="vCPU limit"
            min={1}
            max={ceilings.vcpus}
            step={1}
            value={[limits.vcpus]}
            onValueChange={([vcpus = limits.vcpus]) => onChange({ ...limits, vcpus })}
          />
        </LimitControl>
        <LimitControl label="Memory" value={memoryText}>
          <Slider
            thumbLabel="Memory limit"
            // The thumb's numeric value is a log position, which means nothing when read aloud.
            thumbValueText={memoryText}
            min={0}
            max={MEMORY_SLIDER_STEPS}
            step={1}
            value={[memoryPosition]}
            onValueChange={([position = 0]) => {
              setMemoryPosition(position);
              onChange({ ...limits, memory: positionToMemory(position, ceilings.memory) });
            }}
          />
        </LimitControl>
      </div>
      <p role="status" aria-live="polite" className="text-sm">
        {describeWhatIf(rows, limits)}
      </p>
    </>
  );
}

function LimitControl({
  label,
  value,
  children,
}: {
  label: string;
  value: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium tabular-nums">{value}</span>
      </div>
      {children}
    </div>
  );
}

function CopyAction({
  canHelp,
  passes,
  limits,
  duplicateTo,
}: {
  canHelp: boolean;
  passes: boolean;
  limits: PlacementLimits;
  duplicateTo: string;
}) {
  const reasonId = useId();
  if (passes) {
    const query = new URLSearchParams({
      memory: String(limits.memory),
      vcpus: String(limits.vcpus),
    });
    return (
      <Button size="sm" asChild>
        <Link to={`${duplicateTo}?${query.toString()}`}>Copy with these limits</Link>
      </Button>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <Button size="sm" variant="outline" disabled aria-describedby={reasonId}>
        Copy with these limits
      </Button>
      <span id={reasonId} className="text-sm text-muted-foreground">
        {canHelp
          ? 'No active cluster passes at these limits, so a copy would be blocked too.'
          : 'Limits are not what blocks this service, so changing them cannot help.'}
      </span>
    </div>
  );
}
