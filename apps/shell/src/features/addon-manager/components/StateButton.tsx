import {
  Button,
  StatusDot,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  cn,
  type StatusTone,
} from '@oakestra/ui';
import { LoaderCircleIcon, type LucideIcon } from 'lucide-react';
import { useId, type ReactNode } from 'react';
import { Link } from 'react-router';

export interface StateAction {
  /** What the button turns into on hover and focus ("Retry sync"). */
  label: string;
  icon: LucideIcon;
  /** The accessible name: the action with its object ("Sync acme"). */
  ariaLabel: string;
  onClick?: () => void;
  /** A link instead of a button, for actions that happen on another page. */
  to?: string;
}

interface StateButtonProps {
  tone: StatusTone;
  /** The state at rest ("Sync failed", "Synced 12 days ago"). */
  state: string;
  /** Replaces the status glyph at rest, for states that are not a status (a sync time). */
  stateIcon?: LucideIcon;
  /** Without one the state is shown in the same frame, but cannot be clicked (and has no hint). */
  action?: StateAction;
  /** Why the row is in this state: the error, the failing services. Shown in a tooltip. */
  hint?: ReactNode;
  /** In flight: the state is shown with a spinner instead of its glyph, and no action. */
  pending?: boolean;
  disabled?: boolean;
  'data-testid'?: string;
}

/** Text color of a tone that should stand out; anything else stays muted. */
export function toneTextClassName(tone: StatusTone | undefined): string {
  return tone === 'warning'
    ? 'text-warning'
    : tone === 'destructive'
      ? 'text-destructive'
      : 'text-muted-foreground';
}

// Normal states stay plain text until hovered, so they don't compete with Install. Abnormal ones
// keep a colored frame, matching StatusBadge.
const QUIET =
  'border-transparent bg-transparent text-muted-foreground shadow-none hover:border-input hover:bg-accent hover:text-foreground focus-visible:border-input dark:bg-transparent dark:hover:bg-accent';
const TONE_CLASSES: Partial<Record<StatusTone, string>> = {
  neutral: QUIET,
  success: QUIET,
  warning: 'border-warning/40 text-warning hover:bg-warning/10 hover:text-warning',
  destructive:
    'border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive',
};

/**
 * Shows a row's state, and the action for it on hover or focus. The hint is a tooltip and also the
 * button's description, since screen readers never see tooltips.
 */
export function StateButton({
  tone,
  state,
  stateIcon: StateIcon,
  action,
  hint,
  pending,
  disabled,
  'data-testid': testId,
}: StateButtonProps) {
  const hintId = useId();
  const glyph = StateIcon ? <StateIcon aria-hidden /> : <StatusDot tone={tone} />;
  const frame = cn('w-full justify-center', TONE_CLASSES[tone]);

  let control: ReactNode;
  if (pending) {
    control = (
      <Button variant="outline" size="sm" className={frame} disabled data-testid={testId}>
        <LoaderCircleIcon className="animate-spin" aria-hidden data-icon="inline-start" />
        {state}
      </Button>
    );
  } else if (!action) {
    // Same frame as the button so the column stays aligned.
    return (
      <span
        data-testid={testId}
        className={cn(
          // No hover styles: there is nothing to click.
          'inline-flex h-8 w-full items-center justify-center gap-2 rounded-md border border-transparent px-3 text-sm font-medium [&_svg]:size-4',
          toneTextClassName(tone),
        )}
      >
        {glyph}
        {state}
      </span>
    );
  } else {
    const ActionIcon = action.icon;
    const content = (
      <>
        <span className="flex items-center gap-2 group-hover/state:hidden group-focus-visible/state:hidden">
          {glyph}
          {state}
        </span>
        <span className="hidden items-center gap-2 group-hover/state:flex group-focus-visible/state:flex">
          <ActionIcon aria-hidden />
          {action.label}
        </span>
      </>
    );
    const shared = {
      'aria-label': action.ariaLabel,
      'aria-describedby': hint ? hintId : undefined,
      'data-testid': testId,
    };
    control = action.to ? (
      <Button variant="outline" size="sm" className={cn('group/state', frame)} asChild>
        <Link to={action.to} {...shared}>
          {content}
        </Link>
      </Button>
    ) : (
      <Button
        variant="outline"
        size="sm"
        className={cn('group/state', frame)}
        disabled={disabled}
        onClick={action.onClick}
        {...shared}
      >
        {content}
      </Button>
    );
  }

  if (!hint) return control;
  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>{control}</TooltipTrigger>
        <TooltipContent side="bottom" align="end" className="max-w-sm break-words">
          {hint}
        </TooltipContent>
      </Tooltip>
      <span id={hintId} className="sr-only" data-testid={testId ? `${testId}-hint` : undefined}>
        {hint}
      </span>
    </>
  );
}
