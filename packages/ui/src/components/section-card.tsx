import * as React from 'react';
import { cn } from '../lib/utils';
import { CardAction, CardContent, CardDescription, CardFooter, CardHeader } from './card';

interface SectionCardProps extends Omit<React.ComponentProps<'section'>, 'title'> {
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Buttons or links aligned right of the title ("View all", "Add"). */
  action?: React.ReactNode;
  /** Pages already own the h1 (PageHeader), so sections default to h2. */
  headingLevel?: 2 | 3 | 4;
  /**
   * Removes the content's side and bottom padding, for lists and tables that should run to the
   * card's edges. Give their rows `px-5 sm:px-6` to line up with the title.
   */
  flush?: boolean;
  footer?: React.ReactNode;
  contentClassName?: string;
}

/**
 * A titled card section of a page: header with title, description and an action on the right,
 * then the content. The section is labelled by its title for screen readers.
 */
function SectionCard({
  title,
  description,
  action,
  headingLevel = 2,
  flush = false,
  footer,
  contentClassName,
  className,
  children,
  ...props
}: SectionCardProps) {
  const titleId = React.useId();
  const Heading = `h${headingLevel}` as const;
  return (
    <section
      data-slot="section-card"
      aria-labelledby={titleId}
      className={cn(
        'flex min-w-0 flex-col gap-5 rounded-xl border bg-card py-5 text-card-foreground shadow-xs',
        flush && !footer && 'pb-0',
        className,
      )}
      {...props}
    >
      <CardHeader className="gap-1 px-5 sm:px-6">
        <Heading
          id={titleId}
          data-slot="card-title"
          className="text-base leading-snug font-semibold"
        >
          {title}
        </Heading>
        {description ? <CardDescription>{description}</CardDescription> : null}
        {action ? (
          <CardAction className="flex flex-wrap items-center gap-2">{action}</CardAction>
        ) : null}
      </CardHeader>
      <CardContent
        className={cn(
          flush ? 'overflow-hidden rounded-b-xl px-0' : 'px-5 sm:px-6',
          contentClassName,
        )}
      >
        {children}
      </CardContent>
      {footer ? <CardFooter className="gap-2 px-5 sm:px-6">{footer}</CardFooter> : null}
    </section>
  );
}

export { SectionCard };
export type { SectionCardProps };
