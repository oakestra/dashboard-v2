import { Button, DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from '@oakestra/ui';
import { EllipsisIcon } from 'lucide-react';
import type { ReactNode } from 'react';

/** Kebab menu of a list item. `label` names the item for screen readers ("Actions for alice"). */
export function RowMenu({ label, children }: { label: string; children: ReactNode }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={label}>
          <EllipsisIcon aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">{children}</DropdownMenuContent>
    </DropdownMenu>
  );
}
