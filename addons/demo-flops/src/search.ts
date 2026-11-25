import {
  matchesTokens,
  readCached,
  searchTokens,
  type CommandSource,
} from '@oakestra/dashboard-sdk';

import { projectsQuery } from './queries';
import { STATUS_LABEL } from './status';

export const searchProjects: CommandSource['search'] = async (query, ctx) => {
  const { addon } = ctx;
  if (!addon) return [];
  const tokens = searchTokens(query);
  const projects = await readCached(ctx, projectsQuery());
  return projects
    .filter((project) => matchesTokens(tokens, project.name, project.model))
    .map((project) => ({
      id: project.id,
      label: project.name,
      description: `${STATUS_LABEL[project.status]}, round ${project.roundsDone} of ${project.roundsTotal}`,
      path: addon.path('projects', project.id),
    }));
};
