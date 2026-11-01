import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';

import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '../../src';

const PAGES = 10;

const meta = {
  title: 'Navigation/Pagination',
  component: Pagination,
} satisfies Meta<typeof Pagination>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: function Render(args) {
    const [page, setPage] = useState(4);
    // First, last and the neighbours of the current page; gaps collapse into an ellipsis.
    const visible = [1, page - 1, page, page + 1, PAGES].filter(
      (p, i, all) => p >= 1 && p <= PAGES && all.indexOf(p) === i,
    );
    const go = (next: number) => (event: React.MouseEvent) => {
      event.preventDefault();
      setPage(Math.min(PAGES, Math.max(1, next)));
    };
    return (
      <Pagination {...args}>
        <PaginationContent>
          <PaginationItem>
            <PaginationPrevious href="#" onClick={go(page - 1)} />
          </PaginationItem>
          {visible.map((p, i) => (
            <PaginationItem key={p}>
              {i > 0 && p - (visible[i - 1] ?? p) > 1 ? <PaginationEllipsis /> : null}
              <PaginationLink href="#" isActive={p === page} onClick={go(p)}>
                {p}
              </PaginationLink>
            </PaginationItem>
          ))}
          <PaginationItem>
            <PaginationNext href="#" onClick={go(page + 1)} />
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    );
  },
};
