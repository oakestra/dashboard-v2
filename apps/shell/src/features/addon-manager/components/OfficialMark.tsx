import type { AddonSourceRef } from '@oakestra/api';
import { Tooltip, TooltipContent, TooltipTrigger, cn } from '@oakestra/ui';
import { BadgeCheckIcon } from 'lucide-react';

/**
 * A verified mark after the name of an addon from the official marketplace. It goes by the
 * source's `kind`, which the marketplace sets from its own configuration: a tap can name itself
 * "official", but its kind stays `tap`. Nothing for other sources.
 */
export function OfficialMark({
  source,
  className,
}: {
  source: AddonSourceRef | undefined;
  className?: string;
}) {
  if (source?.kind !== 'official') return null;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {/* Above a stretched link, so the tooltip can be reached with the pointer. */}
        <span
          className={cn('relative z-10 inline-flex shrink-0 self-center', className)}
          data-testid="official-mark"
        >
          {/* Text color, not primary: primary is for interactive elements. */}
          <BadgeCheckIcon aria-hidden className="fill-foreground text-background size-4" />
          <span className="sr-only">Official</span>
        </span>
      </TooltipTrigger>
      <TooltipContent>From the official Oakestra marketplace</TooltipContent>
    </Tooltip>
  );
}
