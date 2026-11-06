import { Button, DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from '@oakestra/ui';
import { MoreHorizontalIcon } from 'lucide-react';
import type { ReactNode } from 'react';

/** Kebab menu of a list item. `label` names the item for screen readers ("Actions for shop"). */
export function RowMenu({ label, children }: { label: string; children: ReactNode }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={label}>
          <MoreHorizontalIcon aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">{children}</DropdownMenuContent>
    </DropdownMenu>
  );
}
