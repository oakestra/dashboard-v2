import { MoreHorizontalIcon } from 'lucide-react';
import type { ReactNode } from 'react';

import { Button } from './button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from './dropdown-menu';

interface RowMenuProps {
  /** Names the menu for screen readers ("Actions for shop"). */
  label: string;
  /** `icon` for a page header next to full-size buttons. */
  size?: 'icon-sm' | 'icon';
  /** `DropdownMenuItem`s. */
  children: ReactNode;
}

/** Kebab menu of a list item or page. */
function RowMenu({ label, size = 'icon-sm', children }: RowMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size={size} aria-label={label}>
          <MoreHorizontalIcon aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">{children}</DropdownMenuContent>
    </DropdownMenu>
  );
}

export { RowMenu, type RowMenuProps };
