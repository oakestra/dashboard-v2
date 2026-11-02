import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { createPortal } from 'react-dom';
import { describe, expect, it, vi } from 'vitest';

import { createDataTableColumnHelper, DataTable } from './data-table';
import { EmptyState } from './empty-state';

interface Row {
  id: string;
  name: string;
  count: number;
}

const column = createDataTableColumnHelper<Row>();
const columns = column.columns([
  column.accessor('name', { header: 'Name' }),
  column.accessor('count', { header: 'Count' }),
]);

const rows: Row[] = [
  { id: 'a', name: 'Charlie', count: 3 },
  { id: 'b', name: 'Alpha', count: 10 },
  { id: 'c', name: 'Bravo', count: 2 },
];

function names() {
  return screen
    .getAllByRole('row')
    .slice(1)
    .map((row) => within(row).getAllByRole('cell')[0]?.textContent);
}

describe('DataTable', () => {
  it('renders rows and headers', () => {
    render(<DataTable label="People" columns={columns} data={rows} getRowId={(r) => r.id} />);
    expect(screen.getByRole('table', { name: 'People' })).toBeInTheDocument();
    expect(names()).toEqual(['Charlie', 'Alpha', 'Bravo']);
  });

  it('sorts by a column and reverses on a second click', async () => {
    const user = userEvent.setup();
    render(<DataTable label="People" columns={columns} data={rows} />);

    await user.click(screen.getByRole('button', { name: 'Name' }));
    expect(names()).toEqual(['Alpha', 'Bravo', 'Charlie']);
    expect(screen.getByRole('columnheader', { name: 'Name' })).toHaveAttribute(
      'aria-sort',
      'ascending',
    );

    await user.click(screen.getByRole('button', { name: 'Name' }));
    expect(names()).toEqual(['Charlie', 'Bravo', 'Alpha']);
  });

  it('sorts numbers numerically', async () => {
    const user = userEvent.setup();
    render(<DataTable label="People" columns={columns} data={rows} />);
    // TanStack starts numeric columns descending.
    await user.click(screen.getByRole('button', { name: 'Count' }));
    expect(names()).toEqual(['Alpha', 'Charlie', 'Bravo']);
    await user.click(screen.getByRole('button', { name: 'Count' }));
    expect(names()).toEqual(['Bravo', 'Charlie', 'Alpha']);
  });

  it('filters with the global search and shows the no-results state', async () => {
    const user = userEvent.setup();
    render(<DataTable label="People" columns={columns} data={rows} />);

    await user.type(screen.getByRole('searchbox', { name: 'Search People' }), 'alp');
    expect(names()).toEqual(['Alpha']);
    expect(screen.getByText('1 of 3 rows')).toBeInTheDocument();

    await user.clear(screen.getByRole('searchbox'));
    await user.type(screen.getByRole('searchbox'), 'zzz');
    expect(screen.getByText('No results')).toBeInTheDocument();
  });

  it('paginates', async () => {
    const user = userEvent.setup();
    const many = Array.from({ length: 25 }, (_, i) => ({
      id: String(i),
      name: `Row ${String(i).padStart(2, '0')}`,
      count: i,
    }));
    render(<DataTable label="People" columns={columns} data={many} initialPageSize={10} />);

    expect(names()).toHaveLength(10);
    expect(screen.getByText('Page 1 of 3')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(names()[0]).toBe('Row 10');
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(names()).toHaveLength(5);
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
  });

  it('shows the empty state, custom or default', () => {
    const { rerender } = render(<DataTable label="People" columns={columns} data={[]} />);
    expect(screen.getByText('Nothing here yet')).toBeInTheDocument();

    rerender(
      <DataTable
        label="People"
        columns={columns}
        data={[]}
        emptyState={<EmptyState title="No people" description="Invite someone." />}
      />,
    );
    expect(screen.getByText('No people')).toBeInTheDocument();
  });

  it('renders skeleton rows while loading', () => {
    render(
      <DataTable label="People" columns={columns} data={undefined} isLoading loadingRows={3} />,
    );
    expect(screen.getAllByTestId('data-table-skeleton-row')).toHaveLength(3);
    expect(screen.queryByText('Nothing here yet')).not.toBeInTheDocument();
  });

  it('right-aligns numeric columns with tabular figures', () => {
    const numeric = column.columns([
      column.accessor('name', { header: 'Name' }),
      column.accessor('count', { header: 'Count', meta: { numeric: true } }),
    ]);
    render(<DataTable label="People" columns={numeric} data={rows} />);
    expect(screen.getByRole('columnheader', { name: 'Count' })).toHaveClass('text-right');
    const cell = screen.getByRole('cell', { name: '10' });
    expect(cell).toHaveClass('text-right', 'tabular-nums');
    expect(screen.getByRole('cell', { name: 'Alpha' })).not.toHaveClass('text-right');
  });

  it('hides paging controls when everything fits on one page', () => {
    render(<DataTable label="People" columns={columns} data={rows} />);
    expect(screen.getByText('3 rows')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Next' })).not.toBeInTheDocument();
  });

  it('calls onRowClick for row clicks but not for buttons inside the row', async () => {
    const user = userEvent.setup();
    const onRowClick = vi.fn();
    const onDelete = vi.fn();
    const withAction = [
      ...columns,
      column.display({
        id: 'actions',
        header: 'Actions',
        cell: () => <button onClick={onDelete}>Delete</button>,
      }),
    ];
    render(<DataTable label="People" columns={withAction} data={rows} onRowClick={onRowClick} />);

    await user.click(screen.getByText('Alpha'));
    expect(onRowClick).toHaveBeenCalledWith(rows[1]);

    await user.click(screen.getAllByRole('button', { name: 'Delete' })[0]!);
    expect(onDelete).toHaveBeenCalled();
    expect(onRowClick).toHaveBeenCalledTimes(1);
  });

  it('ignores clicks inside portals opened from a cell', async () => {
    const user = userEvent.setup();
    const onRowClick = vi.fn();
    // Menus and dialogs render into document.body, but React still bubbles their clicks to the row.
    const withPortal = [
      ...columns,
      column.display({
        id: 'menu',
        header: 'Menu',
        cell: ({ row }) =>
          row.original.id === 'a' ? createPortal(<p>Menu text</p>, document.body) : null,
      }),
    ];
    render(<DataTable label="People" columns={withPortal} data={rows} onRowClick={onRowClick} />);

    await user.click(screen.getByText('Menu text'));
    expect(onRowClick).not.toHaveBeenCalled();
  });

  it('supports controlled filter and sorting state', async () => {
    const user = userEvent.setup();
    const onFilter = vi.fn();
    const onSort = vi.fn();

    function Controlled() {
      const [filter, setFilter] = useState('bra');
      return (
        <DataTable
          label="People"
          columns={columns}
          data={rows}
          globalFilter={filter}
          onGlobalFilterChange={(value) => {
            onFilter(value);
            setFilter(value);
          }}
          sorting={[{ id: 'count', desc: true }]}
          onSortingChange={onSort}
        />
      );
    }
    render(<Controlled />);

    expect(names()).toEqual(['Bravo']);
    await user.type(screen.getByRole('searchbox'), 'v');
    expect(onFilter).toHaveBeenLastCalledWith('brav');

    await user.click(screen.getByRole('button', { name: 'Name' }));
    expect(onSort).toHaveBeenCalledWith([{ id: 'name', desc: false }]);
  });

  describe('with a filter that is applied asynchronously (like a URL search param)', () => {
    function Lagging({ initial = '' }: { initial?: string }) {
      const [filter, setFilter] = useState(initial);
      return (
        <>
          <button type="button" onClick={() => setFilter('alp')}>
            Navigate back
          </button>
          <DataTable
            label="People"
            columns={columns}
            data={rows}
            globalFilter={filter}
            // The router commits location changes a tick later than the keystroke.
            onGlobalFilterChange={(value) => setTimeout(() => setFilter(value), 20)}
          />
        </>
      );
    }

    it('keeps every keystroke of fast typing', async () => {
      const user = userEvent.setup({ delay: null });
      render(<Lagging />);

      await user.type(screen.getByRole('searchbox'), 'bravo');

      expect(screen.getByRole('searchbox')).toHaveValue('bravo');
      await waitFor(() => expect(names()).toEqual(['Bravo']));
      expect(screen.getByRole('searchbox')).toHaveValue('bravo');
    });

    it('adopts a filter that changed from the outside', async () => {
      const user = userEvent.setup({ delay: null });
      render(<Lagging initial="bra" />);
      expect(screen.getByRole('searchbox')).toHaveValue('bra');

      await user.click(screen.getByRole('button', { name: 'Navigate back' }));

      expect(screen.getByRole('searchbox')).toHaveValue('alp');
      expect(names()).toEqual(['Alpha']);
    });
  });
});
