import type { ProjectStatus } from './data';

type Tone = 'info' | 'success' | 'neutral' | 'destructive';

export const STATUS_TONE: Record<ProjectStatus, Tone> = {
  running: 'info',
  completed: 'success',
  queued: 'neutral',
  failed: 'destructive',
};

export const STATUS_LABEL: Record<ProjectStatus, string> = {
  running: 'Running',
  completed: 'Completed',
  queued: 'Queued',
  failed: 'Failed',
};

export function roundPercent(done: number, total: number): number {
  return total === 0 ? 0 : Math.round((done / total) * 100);
}
