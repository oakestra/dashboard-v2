import { hasAnyRole, useCurrentUser } from '@oakestra/dashboard-sdk';
import { Alert, AlertDescription, Button } from '@oakestra/ui';
import { TriangleAlertIcon, XIcon } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router';
import { useStore } from 'zustand';

import { addonLabel, type AddonEntry } from '../../core/addons/addon-registry';
import { useAddonRegistry } from '../../core/addons/addon-registry-context';
import { useModuleEnabled } from '../../core/modules';

/**
 * How long an addon has to stay `failed` before an admin hears about it. The container of a freshly
 * installed addon fails its first loads while it starts, and the loader keeps retrying.
 */
export const ADDON_ISSUE_GRACE_MS = 30_000;

export const DISMISSED_ADDON_ISSUES_KEY = 'oakestra.addon-issues.dismissed';

type AddonIssue = Extract<AddonEntry, { state: 'failed' | 'incompatible' }>;

// Linked packages are left out: they are part of the shell build, the addon manager does not list
// them, and the link here would lead nowhere.
function isIssue(entry: AddonEntry): entry is AddonIssue {
  return entry.origin !== 'linked' && (entry.state === 'failed' || entry.state === 'incompatible');
}

/** Includes the version, so a dismissed failure does not silence the next release's. */
function issueKey(issue: AddonIssue): string {
  return `${issue.name}@${issue.version}:${issue.state}`;
}

// Storage can throw (private windows, blocked site data). The notice then only stays dismissed
// until the next page load.
function readDismissed(): ReadonlySet<string> {
  try {
    const stored: unknown = JSON.parse(
      window.sessionStorage.getItem(DISMISSED_ADDON_ISSUES_KEY) ?? '[]',
    );
    return new Set(Array.isArray(stored) ? stored.map(String) : []);
  } catch {
    return new Set();
  }
}

function writeDismissed(keys: ReadonlySet<string>): void {
  try {
    window.sessionStorage.setItem(DISMISSED_ADDON_ISSUES_KEY, JSON.stringify([...keys]));
  } catch {
    // See readDismissed.
  }
}

/** One per failing addon, keyed by the issue, so React starts and cancels the timers for us. */
function GraceTimer({ id, onElapsed }: { id: string; onElapsed: (id: string) => void }) {
  useEffect(() => {
    const timer = setTimeout(() => onElapsed(id), ADDON_ISSUE_GRACE_MS);
    return () => clearTimeout(timer);
  }, [id, onElapsed]);
  return null;
}

/**
 * Tells admins about remote addons that are not running. Nothing else does: contributions only
 * exist after a successful load, so a failed addon simply leaves no trace on the pages it extends.
 */
export function AddonIssuesNotice() {
  const isAdmin = hasAnyRole(useCurrentUser(), ['Admin']);
  const hasAddonManager = useModuleEnabled('addon-manager');
  return isAdmin && hasAddonManager ? <AddonIssues /> : null;
}

function AddonIssues() {
  const entries = useStore(useAddonRegistry(), (state) => state.entries);
  const [elapsed, setElapsed] = useState<ReadonlySet<string>>(() => new Set());
  const [dismissed, setDismissed] = useState(readDismissed);
  const markElapsed = useCallback((id: string) => {
    setElapsed((previous) => new Set(previous).add(id));
  }, []);

  const issues = Object.values(entries).filter(isIssue);
  const shown = issues.filter(
    (issue) =>
      !dismissed.has(issueKey(issue)) &&
      // Never retried and never going to recover by itself, so there is nothing to wait for.
      (issue.state === 'incompatible' || elapsed.has(issueKey(issue))),
  );

  const dismiss = () => {
    const next = new Set([...dismissed, ...shown.map(issueKey)]);
    writeDismissed(next);
    setDismissed(next);
  };

  return (
    <>
      {issues
        .filter((issue) => issue.state === 'failed')
        .map((issue) => (
          <GraceTimer key={issueKey(issue)} id={issueKey(issue)} onElapsed={markElapsed} />
        ))}
      {shown.length > 0 ? (
        // Not role="alert": this shows up long after the page loaded and is no reason to interrupt
        // a screen reader in the middle of something else.
        <Alert
          variant="warning"
          role="status"
          data-testid="addon-issues-notice"
          className="mb-4 py-2"
        >
          <TriangleAlertIcon aria-hidden />
          <AlertDescription className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <ul className="min-w-0 flex-1 basis-48">
              {shown.map((issue) => (
                <li key={issue.name}>
                  <span className="font-medium">{addonLabel(issue)}</span>{' '}
                  {issue.state === 'failed'
                    ? 'failed to load.'
                    : 'is not compatible with this dashboard version.'}
                </li>
              ))}
            </ul>
            <Button asChild variant="link" size="xs" className="px-0">
              <Link to="/addon-manager/installed">Open addon manager</Link>
            </Button>
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label="Dismiss"
              className="text-muted-foreground"
              onClick={dismiss}
            >
              <XIcon aria-hidden />
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}
    </>
  );
}
