import { XIcon } from 'lucide-react';
import * as React from 'react';
import { cn } from '../lib/utils';
import { Button } from './button';
import { Card } from './card';

// Sections take their level from the panel, so a panel moved below another heading level cannot
// leave its section headings skipping a level.
const SectionLevelContext = React.createContext<3 | 4 | 5>(3);

interface InspectorPanelProps extends Omit<React.ComponentProps<'div'>, 'title' | 'role'> {
  title: React.ReactNode;
  /**
   * Plain text of the title, for the panel's accessible name ("Details of <name>"). Needed when
   * `title` is markup; without either, the panel is named by its heading's text alone.
   */
  name?: string;
  /** What the shown thing is, a small label above the title ("Cluster", "Service"). */
  kind?: React.ReactNode;
  /** Below the title, usually a `StatusBadge`. */
  status?: React.ReactNode;
  /** The main action, pinned below the scrolling body so a long panel never hides it. */
  footer?: React.ReactNode;
  onClose: () => void;
  /** Level of the title; `InspectorSection` headings are one below it. */
  headingLevel?: 2 | 3 | 4;
}

/**
 * Details of a selected item next to the view it was selected in, such as the `inspector` of a
 * `FlowGraph`: header with kind, title, status and a close button, a scrolling body (`children`)
 * and an optional footer.
 *
 * Only the body scrolls: a container that caps the panel's height (FlowGraph's floating panel
 * does) keeps the header and the footer in view. Without a cap the panel just grows.
 */
function InspectorPanel({
  title,
  name,
  kind,
  status,
  footer,
  onClose,
  headingLevel = 2,
  className,
  children,
  ...props
}: InspectorPanelProps) {
  const Heading = `h${headingLevel}` as const;
  const headingId = React.useId();
  const label = name ?? (typeof title === 'string' ? title : undefined);
  return (
    <Card
      data-slot="inspector-panel"
      role="region"
      aria-label={label === undefined ? undefined : `Details of ${label}`}
      aria-labelledby={label === undefined ? headingId : undefined}
      className={cn(
        'flex min-h-0 min-w-0 flex-col gap-0 overflow-hidden py-0 shadow-xs',
        className,
      )}
      {...props}
    >
      <div className="flex shrink-0 items-start gap-2 border-b p-4">
        <div className="min-w-0 flex-1 space-y-1">
          {kind ? <p className="text-xs text-muted-foreground">{kind}</p> : null}
          <Heading id={headingId} className="text-lg leading-6 font-medium wrap-break-word">
            {title}
          </Heading>
          {status}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Close details"
          onClick={onClose}
        >
          <XIcon aria-hidden />
        </Button>
      </div>
      <SectionLevelContext.Provider value={(headingLevel + 1) as 3 | 4 | 5}>
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">{children}</div>
      </SectionLevelContext.Provider>
      {footer ? <div className="flex shrink-0 gap-2 border-t p-3">{footer}</div> : null}
    </Card>
  );
}

interface InspectorSectionProps extends Omit<React.ComponentProps<'section'>, 'title'> {
  title: React.ReactNode;
}

/** A titled group in the body of an `InspectorPanel`: a small muted heading over its content. */
function InspectorSection({ title, className, children, ...props }: InspectorSectionProps) {
  const Heading = `h${React.useContext(SectionLevelContext)}` as const;
  return (
    <section data-slot="inspector-section" className={cn('space-y-1.5', className)} {...props}>
      <Heading className="text-xs font-medium text-muted-foreground">{title}</Heading>
      {children}
    </section>
  );
}

export { InspectorPanel, InspectorSection };
export type { InspectorPanelProps, InspectorSectionProps };
