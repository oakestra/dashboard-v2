import { Button, DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from '@oakestra/ui';
import { MoreHorizontalIcon } from 'lucide-react';
import type { ReactNode } from 'react';

/** Kebab menu for a table row. `label` names the row for screen readers ("Actions for shop"). */
export function RowMenu({ label, children }: { label: string; children: ReactNode }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={label}>
          <MoreHorizontalIcon aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      {/* React events bubble through the portal into the clickable table row, which would open
          it behind the item the user just picked. */}
      <DropdownMenuContent align="end" onClick={(event) => event.stopPropagation()}>
        {children}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
