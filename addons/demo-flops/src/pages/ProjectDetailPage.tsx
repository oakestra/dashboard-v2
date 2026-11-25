import { useAddonPath, useNotify, type AddonCrumbProps } from '@oakestra/dashboard-sdk';
import {
  Button,
  EmptyState,
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemTitle,
  PageHeader,
  Progress,
  SectionCard,
  StatCard,
  StatGroup,
  StatusBadge,
  formatPercent,
  plural,
} from '@oakestra/ui';
import { TimeSeriesChart } from '@oakestra/ui/chart';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeftIcon, BrainCircuitIcon, PlayIcon } from 'lucide-react';
import { Link, useParams } from 'react-router';

import { latestMetric, type FlProject } from '../data';
import { projectsQuery } from '../queries';
import { roundPercent, STATUS_LABEL, STATUS_TONE } from '../status';

// Shares the page's query, so the crumb costs no extra request.
export function ProjectCrumb({ params }: AddonCrumbProps) {
  const projects = useQuery(projectsQuery());
  return projects.data?.find((project) => project.id === params.projectId)?.name ?? 'Project';
}

export function ProjectDetailPage() {
  const { projectId } = useParams();
  const projects = useQuery(projectsQuery());
  const addonPath = useAddonPath();
  const project = projects.data?.find((candidate) => candidate.id === projectId);

  if (projects.isPending) return <p className="fl:text-muted-foreground fl:text-sm">Loading...</p>;
  if (!project) {
    return (
      <EmptyState
        icon={<BrainCircuitIcon />}
        title="Project not found"
        description={`There is no federated learning project "${projectId ?? ''}".`}
        action={
          <Button asChild variant="outline">
            <Link to={addonPath()}>Back to projects</Link>
          </Button>
        }
      />
    );
  }
  return <ProjectDetail project={project} />;
}

function ProjectDetail({ project }: { project: FlProject }) {
  const addonPath = useAddonPath();
  const notify = useNotify();
  const latest = latestMetric(project);
  const accuracy = project.metrics.map((metric) => ({
    timestamp: metric.timestamp,
    value: metric.accuracy,
  }));
  const loss = project.metrics.map((metric) => ({
    timestamp: metric.timestamp,
    value: metric.loss,
  }));

  return (
    <div className="fl:space-y-5">
      <PageHeader
        title={project.name}
        description={project.description}
        actions={
          <>
            <StatusBadge tone={STATUS_TONE[project.status]} pulse={project.status === 'running'}>
              {STATUS_LABEL[project.status]}
            </StatusBadge>
            <Button
              disabled={project.status !== 'running'}
              onClick={() => notify.success(`Round ${project.roundsDone + 1} requested`)}
            >
              <PlayIcon />
              Start new round
            </Button>
            <Button asChild variant="outline">
              <Link to={addonPath()}>
                <ArrowLeftIcon />
                Projects
              </Link>
            </Button>
          </>
        }
      />
      <StatGroup>
        <StatCard
          label="Rounds"
          value={`${project.roundsDone} / ${project.roundsTotal}`}
          hint={`${roundPercent(project.roundsDone, project.roundsTotal)}% done`}
        />
        <StatCard
          label="Accuracy"
          value={latest ? formatPercent(latest.accuracy, 1) : '-'}
          hint={project.model}
        />
        <StatCard
          label="Loss"
          value={latest ? latest.loss.toFixed(3) : '-'}
          hint={project.strategy}
        />
        <StatCard label="Learners" value={project.learners.length} />
      </StatGroup>
      <Progress
        value={roundPercent(project.roundsDone, project.roundsTotal)}
        aria-label="Round progress"
      />
      {project.metrics.length > 0 ? (
        <div className="fl:grid fl:gap-4 fl:lg:grid-cols-2">
          <SectionCard title="Accuracy per round">
            <TimeSeriesChart title="Accuracy" unit="percent" data={accuracy} />
          </SectionCard>
          <SectionCard title="Loss per round">
            <TimeSeriesChart
              title="Loss"
              unit={(value) => value.toFixed(2)}
              data={loss}
              variant="line"
            />
          </SectionCard>
        </div>
      ) : (
        <EmptyState
          icon={<BrainCircuitIcon />}
          title="No rounds yet"
          description="Metrics show up here as soon as the first round is aggregated."
        />
      )}
      <SectionCard
        title="Learners"
        description={`${plural(project.learners.length, 'learner')}, each training on its own cluster.`}
        flush
      >
        <ItemGroup>
          {project.learners.map((learner) => (
            <Item key={learner.id}>
              <ItemContent>
                <ItemTitle>{learner.cluster}</ItemTitle>
                <ItemDescription>{learner.samples.toLocaleString()} local samples</ItemDescription>
              </ItemContent>
              <ItemActions className="fl:text-muted-foreground fl:text-sm fl:tabular-nums">
                {learner.lastRound > 0
                  ? `${learner.lastRoundShare}% of round ${learner.lastRound}`
                  : 'Not started'}
              </ItemActions>
            </Item>
          ))}
        </ItemGroup>
      </SectionCard>
    </div>
  );
}
