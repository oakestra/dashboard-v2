import { useAddonPath } from '@oakestra/dashboard-sdk';
import { Link } from 'react-router';

import { formatIntensity, formatKg, formatKw, summarize } from '../estimate';
import { useFootprints } from '../use-footprints';

export function FootprintWidget() {
  const addonPath = useAddonPath();
  const { footprints } = useFootprints();
  if (!footprints) return null;
  const fleet = summarize(footprints);

  return (
    <div className="co:space-y-1">
      <p className="co:text-2xl co:font-semibold co:tabular-nums">
        {fleet.reporting > 0 ? formatKg(fleet.co2KgDay) : 'No estimate'}
        <span className="co:ml-1 co:text-sm co:font-normal co:text-muted-foreground">
          CO2, last 24 h
        </span>
      </p>
      <p className="co:text-sm co:text-muted-foreground">
        {fleet.greenest
          ? `Greenest: ${fleet.greenest.name} at ${formatIntensity(fleet.greenest.intensity)}.`
          : 'No cluster is reporting.'}{' '}
        Estimate, demo data.
      </p>
      <Link className="co:text-sm co:underline" to={addonPath()}>
        Open Carbon & Energy
      </Link>
    </div>
  );
}

export function EnergyWidget({ clusterId }: { clusterId: string }) {
  const { footprints } = useFootprints();
  const footprint = footprints?.find((f) => f.clusterId === clusterId);
  if (!footprint) return null;

  if (footprint.kind !== 'estimate') {
    return <p className="co:text-sm co:text-muted-foreground">{footprint.reason}</p>;
  }
  const { estimate } = footprint;
  return (
    <div className="co:space-y-2">
      <dl className="co:grid co:grid-cols-3 co:gap-3 co:text-sm">
        <Figure label="Power" value={formatKw(estimate.powerKw)} />
        <Figure label="Grid intensity" value={formatIntensity(estimate.intensity)} />
        <Figure label="CO2 per day" value={formatKg(estimate.co2KgDay)} />
      </dl>
      <p className="co:text-xs co:text-muted-foreground">Estimate, demo data.</p>
    </div>
  );
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="co:text-muted-foreground">{label}</dt>
      <dd className="co:font-medium co:tabular-nums">{value}</dd>
    </div>
  );
}
