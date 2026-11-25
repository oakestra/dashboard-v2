import { PageHeader, SectionCard } from '@oakestra/ui';

export function MethodologyPage() {
  return (
    <div className="co:space-y-6">
      <PageHeader title="Methodology" description="How the numbers on these pages are made." />
      <SectionCard title="These are estimates">
        <div className="co:space-y-3 co:text-sm">
          <p>
            Nothing here is metered. The demo derives every figure from what your clusters report
            and a few fixed assumptions, so it is stable between visits but not a real measurement.
          </p>
          <p>
            <strong>Power.</strong> Each vCPU is assumed to draw 6 W idle and 24 W at full load,
            interpolated by the cluster's CPU usage, plus 0.15 kW per cluster for networking and
            cooling.
          </p>
          <p>
            <strong>Grid intensity.</strong> A regional base value (gCO2/kWh) is guessed from the
            cluster's location, then shaped over the day: higher in the evening, lower around midday
            when solar output peaks.
          </p>
          <p>
            <strong>Emissions.</strong> Hourly power times hourly intensity, summed over the last 24
            hours.
          </p>
          <p>
            <strong>Silent clusters.</strong> A cluster that stopped reporting, or never reported,
            has no current usage, so it is left out of the totals instead of guessed.
          </p>
        </div>
      </SectionCard>
    </div>
  );
}
