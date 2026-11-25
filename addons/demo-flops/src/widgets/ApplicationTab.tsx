import { useAddonPath, useOakestraApi, type ApplicationContext } from '@oakestra/dashboard-sdk';
import { Button, EmptyState, SectionCard, StatusBadge, formatPercent } from '@oakestra/ui';
import { useQuery } from '@tanstack/react-query';
import { BrainCircuitIcon } from 'lucide-react';
import { Link } from 'react-router';

import { latestMetric, projectForApplication } from '../data';
import { applicationQuery } from '../queries';
import { STATUS_LABEL, STATUS_TONE } from '../status';

export function ApplicationTab({ applicationId }: ApplicationContext) {
  const api = useOakestraApi();
  const addonPath = useAddonPath();
  const application = useQuery(applicationQuery(api, applicationId));

  if (application.isPending) {
    return <p className="fl:text-muted-foreground fl:text-sm">Loading...</p>;
  }
  const project = application.data
    ? projectForApplication(application.data.application_name)
    : undefined;
  if (!project) {
    return (
      <EmptyState
        icon={<BrainCircuitIcon />}
        title="Not part of a federated learning project"
        description="No training run uses this application as its aggregator or learner."
      />
    );
  }

  const latest = latestMetric(project);
  return (
    <SectionCard
      title={project.name}
      description={project.description}
      action={
        <StatusBadge tone={STATUS_TONE[project.status]}>{STATUS_LABEL[project.status]}</StatusBadge>
      }
    >
      <div className="fl:flex fl:flex-wrap fl:items-center fl:justify-between fl:gap-3">
        <p className="fl:text-sm fl:tabular-nums">
          {project.roundsDone} of {project.roundsTotal} rounds
          {latest ? `, accuracy ${formatPercent(latest.accuracy, 1)}` : ''}
        </p>
        <Button asChild variant="outline">
          <Link to={addonPath('projects', project.id)}>Open project</Link>
        </Button>
      </div>
    </SectionCard>
  );
}
