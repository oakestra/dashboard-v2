import { useAddonPath } from '@oakestra/dashboard-sdk';
import {
  EmptyState,
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemTitle,
  PageHeader,
  Progress,
  QueryErrorAlert,
  StatCard,
  StatGroup,
  StatusBadge,
  formatPercent,
  plural,
  stretchedLinkClassName,
} from '@oakestra/ui';
import { DataList } from '@oakestra/ui/data-table';
import { useQuery } from '@tanstack/react-query';
import { BrainCircuitIcon, NetworkIcon, TargetIcon } from 'lucide-react';
import { Link } from 'react-router';

import { bestAccuracy, type FlProject } from '../data';
import { projectsQuery } from '../queries';
import { roundPercent, STATUS_LABEL, STATUS_TONE } from '../status';

const searchValue = (project: FlProject) =>
  `${project.name} ${project.model} ${project.learners.map((learner) => learner.cluster).join(' ')}`;

export function ProjectsPage() {
  const projects = useQuery(projectsQuery());
  const addonPath = useAddonPath();
  const data = projects.data;
  const running = data?.filter((project) => project.status === 'running') ?? [];
  const learners = running.reduce((sum, project) => sum + project.learners.length, 0);
  const best = data ? bestAccuracy(data) : undefined;

  return (
    <div className="fl:space-y-5">
      <PageHeader
        title="Federated learning"
        description="Models trained across several clusters. The training data stays on each cluster."
      />
      <StatGroup>
        <StatCard
          label="Active projects"
          value={data ? running.length : '-'}
          icon={<BrainCircuitIcon />}
          loading={projects.isPending}
        />
        <StatCard
          label="Learners in training"
          value={data ? learners : '-'}
          icon={<NetworkIcon />}
          loading={projects.isPending}
        />
        <StatCard
          label="Best accuracy"
          value={best === undefined ? '-' : formatPercent(best, 1)}
          icon={<TargetIcon />}
          loading={projects.isPending}
        />
      </StatGroup>
      {projects.isError ? (
        <QueryErrorAlert
          title="Projects could not be loaded"
          error={projects.error}
          onRetry={() => void projects.refetch()}
        />
      ) : (
        <DataList
          label="Federated learning projects"
          noun="project"
          data={data}
          getRowId={(project) => project.id}
          isLoading={projects.isPending}
          searchValue={searchValue}
          searchPlaceholder="Search projects"
          emptyState={
            <EmptyState
              icon={<BrainCircuitIcon />}
              title="No projects yet"
              description="Projects appear here once a training run is registered."
            />
          }
          renderItem={(project) => (
            <Item>
              <ItemContent>
                <ItemTitle>
                  <Link to={addonPath('projects', project.id)} className={stretchedLinkClassName}>
                    {project.name}
                  </Link>
                </ItemTitle>
                <ItemDescription>
                  {project.model}, {plural(project.learners.length, 'learner')} on{' '}
                  {plural(
                    new Set(project.learners.map((learner) => learner.cluster)).size,
                    'cluster',
                  )}
                </ItemDescription>
              </ItemContent>
              <ItemActions className="fl:gap-4">
                <div className="fl:hidden fl:w-40 fl:space-y-1 fl:sm:block">
                  <Progress
                    value={roundPercent(project.roundsDone, project.roundsTotal)}
                    aria-label={`Rounds of ${project.name}`}
                  />
                  <p className="fl:text-muted-foreground fl:text-xs fl:tabular-nums">
                    Round {project.roundsDone} of {project.roundsTotal}
                  </p>
                </div>
                <StatusBadge
                  tone={STATUS_TONE[project.status]}
                  pulse={project.status === 'running'}
                >
                  {STATUS_LABEL[project.status]}
                </StatusBadge>
              </ItemActions>
            </Item>
          )}
        />
      )}
    </div>
  );
}
