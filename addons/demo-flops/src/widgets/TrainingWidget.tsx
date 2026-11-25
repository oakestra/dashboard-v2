import { useAddonPath } from '@oakestra/dashboard-sdk';
import { Progress } from '@oakestra/ui';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';

import { projectsQuery } from '../queries';
import { roundPercent } from '../status';

export function TrainingWidget() {
  const projects = useQuery(projectsQuery());
  const addonPath = useAddonPath();
  const running = projects.data?.filter((project) => project.status === 'running') ?? [];
  if (running.length === 0) return null;

  return (
    <ul className="fl:space-y-3">
      {running.map((project) => (
        <li key={project.id} className="fl:space-y-1">
          <div className="fl:flex fl:items-baseline fl:justify-between fl:gap-3 fl:text-sm">
            <Link className="fl:truncate fl:font-medium" to={addonPath('projects', project.id)}>
              {project.name}
            </Link>
            <span className="fl:text-muted-foreground fl:text-xs fl:tabular-nums">
              {project.roundsDone}/{project.roundsTotal}
            </span>
          </div>
          <Progress
            value={roundPercent(project.roundsDone, project.roundsTotal)}
            aria-label={`Rounds of ${project.name}`}
          />
        </li>
      ))}
    </ul>
  );
}
