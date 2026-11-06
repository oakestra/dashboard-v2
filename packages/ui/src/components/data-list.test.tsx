import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { DataList, type DataListSortOption } from './data-list';

interface Fruit {
  id: string;
  name: string;
  weight: number;
}

const fruits: Fruit[] = [
  { id: '1', name: 'pear', weight: 180 },
  { id: '2', name: 'apple', weight: 150 },
  { id: '3', name: 'melon', weight: 900 },
];

const searchValue = (fruit: Fruit) => fruit.name;
const sortOptions: readonly DataListSortOption<Fruit>[] = [
  { id: 'name', label: 'Name', value: (fruit) => fruit.name },
  { id: 'heaviest', label: 'Heaviest first', value: (fruit) => fruit.weight, desc: true },
];

function renderList(props: Partial<React.ComponentProps<typeof DataList<Fruit>>> = {}) {
  render(
    <DataList
      label="Fruits"
      noun="fruit"
      data={fruits}
      getRowId={(fruit) => fruit.id}
      renderItem={(fruit) => <span>{fruit.name}</span>}
      searchValue={searchValue}
      {...props}
    />,
  );
}

const names = () =>
  within(screen.getByRole('list', { name: 'Fruits' }))
    .getAllByRole('listitem')
    .map((item) => item.textContent);

describe('<DataList>', () => {
  it('keeps the order of the data without sort options, and offers no picker', () => {
    renderList();
    expect(names()).toEqual(['pear', 'apple', 'melon']);
    expect(screen.queryByRole('combobox', { name: 'Sort Fruits' })).not.toBeInTheDocument();
  });

  it('sorts by the first option and switches through the picker', async () => {
    const user = userEvent.setup();
    renderList({ sortOptions });
    expect(names()).toEqual(['apple', 'melon', 'pear']);

    await user.click(screen.getByRole('combobox', { name: 'Sort Fruits' }));
    await user.click(await screen.findByRole('option', { name: 'Heaviest first' }));

    expect(names()).toEqual(['melon', 'pear', 'apple']);
  });

  it('searches only in searchValue and reports the count', async () => {
    const user = userEvent.setup();
    renderList({ sortOptions });

    await user.type(screen.getByRole('searchbox', { name: 'Search Fruits' }), 'me');

    expect(names()).toEqual(['melon']);
    expect(screen.getByText('1 of 3 fruits')).toBeVisible();
  });

  it('tells an empty list from a search without results', async () => {
    const user = userEvent.setup();
    renderList({ emptyState: <p>No fruit yet</p> });

    await user.type(screen.getByRole('searchbox', { name: 'Search Fruits' }), 'kiwi');
    expect(screen.getByText('No results')).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Clear search' }));
    expect(names()).toHaveLength(3);
  });

  it('shows the empty state without data', () => {
    renderList({ data: [], emptyState: <p>No fruit yet</p> });
    expect(screen.getByText('No fruit yet')).toBeVisible();
    expect(screen.queryByRole('searchbox')).not.toBeInTheDocument();
  });

  it('shows skeletons while loading', () => {
    renderList({ data: undefined, isLoading: true, loadingItems: 2 });
    expect(screen.getAllByTestId('data-list-skeleton')).toHaveLength(2);
    expect(screen.queryByRole('list', { name: 'Fruits' })).not.toBeInTheDocument();
  });

  it('pages through the items', async () => {
    const user = userEvent.setup();
    renderList({ pageSizeOptions: [2, 4] });
    expect(names()).toEqual(['pear', 'apple']);

    await user.click(screen.getByRole('button', { name: 'Next' }));

    expect(names()).toEqual(['melon']);
    expect(screen.getByText('Page 2 of 2')).toBeVisible();
  });
});
