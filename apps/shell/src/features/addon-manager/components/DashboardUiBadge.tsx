import { StatusBadge, Tooltip, TooltipContent, TooltipTrigger } from '@oakestra/ui';
import { LoaderCircleIcon } from 'lucide-react';

import { addonLabel, type AddonEntry } from '../../../core/addons/addon-registry';

/** Describes why a Dashboard UI is not working, or null when it is. */
export function dashboardUiProblem(entry: AddonEntry | undefined): string | null {
  return entry?.state === 'failed' || entry?.state === 'incompatible' ? entry.error : null;
}

/**
 * Runtime state of an addon's UI in this browser tab, from the addon registry. A missing entry
 * means the addon ships no UI (or is not active), which is the normal case.
 */
export function DashboardUiBadge({ entry }: { entry: AddonEntry | undefined }) {
  if (!entry) return <span className="text-muted-foreground">None</span>;

  switch (entry.state) {
    case 'loaded':
      return (
        <StatusBadge tone="success" title={`${addonLabel(entry)}, version ${entry.version}`}>
          Loaded
          <span className="text-muted-foreground font-normal">{entry.version}</span>
        </StatusBadge>
      );
    case 'loading':
      return (
        <StatusBadge tone="info" icon={<LoaderCircleIcon className="animate-spin" aria-hidden />}>
          Loading
        </StatusBadge>
      );
    case 'failed':
    case 'incompatible': {
      const failed = entry.state === 'failed';
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            {/* Focusable so keyboard users reach the reason as well. */}
            <button type="button" className="rounded-full focus-visible:outline-2">
              <StatusBadge tone={failed ? 'destructive' : 'warning'}>
                {failed ? 'Failed' : 'Incompatible'}
              </StatusBadge>
            </button>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs break-words">{entry.error}</TooltipContent>
        </Tooltip>
      );
    }
  }
}
