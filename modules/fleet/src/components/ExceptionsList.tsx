import {
  Badge,
  Button,
  formatRelativeTime,
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
  SectionCard,
} from '@oakestra/ui';
import { ChevronRightIcon } from 'lucide-react';
import { useState } from 'react';

import type { FleetException } from '../lib';
import { Mark } from './Mark';

// Few enough that the board, the main content of the page, starts on the first screen.
const COLLAPSED_COUNT = 3;

interface ExceptionsListProps {
  exceptions: readonly FleetException[];
  onSelect: (selection: string) => void;
}

/** What needs a person, worst first. Nothing at all when the fleet is fine. */
export function ExceptionsList({ exceptions, onSelect }: ExceptionsListProps) {
  const [showAll, setShowAll] = useState(false);
  if (exceptions.length === 0) return null;

  // Silent clusters sort last, and a "Show 1 more" row would take the same room as that one entry.
  const collapsible = exceptions.length > COLLAPSED_COUNT + 1;
  const shown = showAll || !collapsible ? exceptions : exceptions.slice(0, COLLAPSED_COUNT);
  const hidden = exceptions.length - shown.length;
  return (
    <SectionCard
      title="Needs attention"
      flush
      action={<Badge variant="secondary">{exceptions.length}</Badge>}
    >
      <ul className="divide-y border-t">
        {shown.map((exception) => (
          <li key={exception.key}>
            <Item
              asChild
              size="sm"
              className="hover:bg-accent/40 group w-full flex-nowrap rounded-none px-5 py-2 text-left"
            >
              <button type="button" onClick={() => onSelect(exception.selection)}>
                <ItemMedia className="w-2.5">
                  {exception.tone === 'stale' ? (
                    <Mark tone="neutral" stale />
                  ) : (
                    <Mark tone={exception.tone} />
                  )}
                </ItemMedia>
                <ItemContent className="gap-0">
                  <ItemTitle>
                    <span className="truncate">{exception.title}</span>
                  </ItemTitle>
                  {exception.detail ? (
                    <ItemDescription className="line-clamp-1 text-xs">
                      {exception.detail}
                    </ItemDescription>
                  ) : null}
                </ItemContent>
                <ItemActions>
                  {exception.since ? (
                    <span className="text-muted-foreground text-xs whitespace-nowrap">
                      {formatRelativeTime(exception.since)}
                    </span>
                  ) : null}
                  <ChevronRightIcon
                    aria-hidden
                    className="text-muted-foreground/60 group-hover:text-foreground size-4"
                  />
                </ItemActions>
              </button>
            </Item>
          </li>
        ))}
        {collapsible ? (
          <li className="px-3 py-1.5">
            <Button variant="ghost" size="sm" onClick={() => setShowAll(!showAll)}>
              {showAll ? 'Show fewer' : `Show ${hidden} more`}
            </Button>
          </li>
        ) : null}
      </ul>
    </SectionCard>
  );
}
