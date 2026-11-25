import { useFeatureEnabled } from '@oakestra/dashboard-sdk';
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemTitle,
  PageHeader,
  QueryErrorAlert,
  SectionCard,
  StatCard,
  StatGroup,
  StatusBadge,
} from '@oakestra/ui';
import { TimeSeriesChart } from '@oakestra/ui/chart';
import { Link } from 'react-router';

import { formatIntensity, formatKg, formatKw, summarize, type ClusterFootprint } from '../estimate';
import { useFootprints } from '../use-footprints';

export function OverviewPage() {
  const { query, footprints } = useFootprints();
  const hasInfrastructure = useFeatureEnabled('infrastructure');

  if (query.isError) {
    return (
      <QueryErrorAlert
        title="Could not load clusters"
        error={query.error}
        onRetry={() => void query.refetch()}
      />
    );
  }
  if (!footprints) return <p className="co:text-sm co:text-muted-foreground">Loading...</p>;

  const fleet = summarize(footprints);
  const none = fleet.reporting === 0;

  return (
    <div className="co:space-y-6">
      <PageHeader
        title="Carbon & Energy"
        description="Estimated power and emissions of your clusters. Demo data, not measured."
      />
      <StatGroup>
        <StatCard label="Total power" value={none ? 'n/a' : formatKw(fleet.powerKw)} />
        <StatCard label="CO2, last 24 h" value={none ? 'n/a' : formatKg(fleet.co2KgDay)} />
        <StatCard
          label="Average intensity"
          value={fleet.intensity === null ? 'n/a' : formatIntensity(fleet.intensity)}
        />
        <StatCard
          label="Greenest cluster"
          value={fleet.greenest?.name ?? 'n/a'}
          hint={fleet.greenest ? formatIntensity(fleet.greenest.intensity) : undefined}
        />
      </StatGroup>
      {fleet.history.length > 0 && (
        <SectionCard title="Fleet power" description="Estimated draw of reporting clusters, 24 h.">
          <TimeSeriesChart
            title="Fleet power over 24 hours"
            data={fleet.history}
            unit={(value) => formatKw(value)}
          />
        </SectionCard>
      )}
      <SectionCard title="Clusters" flush>
        <ItemGroup>
          {footprints.map((footprint) => (
            <ClusterRow
              key={footprint.clusterId}
              footprint={footprint}
              linked={hasInfrastructure}
            />
          ))}
        </ItemGroup>
      </SectionCard>
    </div>
  );
}

function ClusterRow({ footprint, linked }: { footprint: ClusterFootprint; linked: boolean }) {
  const title = linked ? (
    <Link
      className="co:hover:underline"
      to={`/infrastructure/clusters/${encodeURIComponent(footprint.clusterId)}`}
    >
      {footprint.name}
    </Link>
  ) : (
    footprint.name
  );

  return (
    <Item className="co:px-5">
      <ItemContent>
        <ItemTitle>{title}</ItemTitle>
        <ItemDescription>
          {footprint.kind === 'estimate'
            ? `${formatIntensity(footprint.estimate.intensity)} grid, ${formatKg(footprint.estimate.co2KgDay)} CO2 per day`
            : footprint.reason}
        </ItemDescription>
      </ItemContent>
      <ItemActions>
        {footprint.kind === 'estimate' ? (
          <span className="co:text-sm co:font-medium co:tabular-nums">
            {formatKw(footprint.estimate.powerKw)}
          </span>
        ) : (
          <StatusBadge tone="neutral">
            {footprint.kind === 'silent' ? 'Not reporting' : 'Never reported'}
          </StatusBadge>
        )}
      </ItemActions>
    </Item>
  );
}
