import {
  createColumnHelper,
  useTable,
  type PaginationState,
  type SortingState,
} from '@tanstack/react-table';
import * as React from 'react';

import { cn } from '../lib/utils';
import { CollectionSearch } from './collection-search';
import {
  CollectionEmpty,
  CollectionFooter,
  dataTableFeatures,
  useCollectionPaging,
  useControllable,
} from './data-table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './select';
import { Skeleton } from './skeleton';

interface DataListSortOption<TData> {
  id: string;
  /** Says the direction when it is not obvious: "Newest first". */
  label: string;
  value: (row: TData) => string | number;
  desc?: boolean;
}

interface DataListProps<TData extends object> {
  data: readonly TData[] | undefined;
  /** Stable ids keep open menus and focus across refetches. */
  getRowId: (row: TData) => string;
  /** One item: an `Item` for `list`, a `Card` for `grid`. */
  renderItem: (row: TData) => React.ReactNode;
  /** Accessible name of the list and its search box. */
  label: string;
  /** Singular name of an item in the result count. */
  noun?: string;
  /** `list` joins items in one panel, `grid` lays out separate cards. */
  layout?: 'list' | 'grid';
  /** The text search looks in. Keep it stable (module scope): it feeds the row model. */
  searchValue?: (row: TData) => string;
  /** Offers a sort picker. Keep it stable like `searchValue`. Without it, `data` order is kept. */
  sortOptions?: readonly DataListSortOption<TData>[];
  /** Renders skeletons instead of data; use for the first load (`query.isPending`). */
  isLoading?: boolean;
  loadingItems?: number;
  /** Shown when `data` is empty. */
  emptyState?: React.ReactNode;
  /** Shown when the search matches nothing. */
  noResultsState?: React.ReactNode;
  /** Extra controls right of the search box. */
  toolbar?: React.ReactNode;
  hideSearch?: boolean;
  searchPlaceholder?: string;
  pageSizeOptions?: readonly number[];
  className?: string;

  // Uncontrolled unless the value is passed. Pass value and handler together to mirror the state
  // into URL search params.
  globalFilter?: string;
  onGlobalFilterChange?: (value: string) => void;
  /** Id of the active sort option; the first one by default. */
  sort?: string;
  onSortChange?: (value: string) => void;
  pagination?: PaginationState;
  onPaginationChange?: (value: PaginationState) => void;
}

const SEARCH_COLUMN = 'search';
const LIST_PAGE_SIZES = [25, 50, 100];
// Multiples of the one, two and three columns the grid goes through, so a full page has no hole.
const GRID_PAGE_SIZES = [12, 24, 48, 96];
const emptyRows: never[] = [];
const noSortOptions: never[] = [];
const noSearch = () => '';

/**
 * A searchable, sortable, paged collection of `Item`s or `Card`s: the same state and row models as
 * `DataTable`, for anything that reads better as a list of things than as a grid of columns.
 */
function DataList<TData extends object>({
  data,
  getRowId,
  renderItem,
  label,
  noun = 'item',
  layout = 'list',
  searchValue = noSearch,
  sortOptions = noSortOptions,
  isLoading = false,
  loadingItems,
  emptyState,
  noResultsState,
  toolbar,
  hideSearch = false,
  searchPlaceholder = 'Search...',
  pageSizeOptions = layout === 'grid' ? GRID_PAGE_SIZES : LIST_PAGE_SIZES,
  className,
  globalFilter: globalFilterProp,
  onGlobalFilterChange,
  sort: sortProp,
  onSortChange,
  pagination: paginationProp,
  onPaginationChange,
}: DataListProps<TData>) {
  const [globalFilter, setGlobalFilter] = useControllable(
    globalFilterProp,
    '',
    onGlobalFilterChange,
  );
  const [sortId, setSortId] = useControllable(sortProp, sortOptions[0]?.id ?? '', onSortChange);
  const [pagination, setPagination] = useControllable<PaginationState>(
    paginationProp,
    { pageIndex: 0, pageSize: pageSizeOptions[0] ?? 25 },
    onPaginationChange,
  );

  const columns = React.useMemo(() => {
    const column = createColumnHelper<typeof dataTableFeatures, TData>();
    return column.columns([
      column.accessor(searchValue, { id: SEARCH_COLUMN, enableSorting: false }),
      ...sortOptions.map((option) =>
        column.accessor(option.value, { id: `sort-${option.id}`, enableGlobalFilter: false }),
      ),
    ]);
  }, [searchValue, sortOptions]);

  const activeSort = sortOptions.find((option) => option.id === sortId) ?? sortOptions[0];
  const sorting = React.useMemo<SortingState>(
    () => (activeSort ? [{ id: `sort-${activeSort.id}`, desc: activeSort.desc ?? false }] : []),
    [activeSort],
  );

  const table = useTable({
    features: dataTableFeatures,
    columns,
    data: data ?? emptyRows,
    getRowId: (row) => getRowId(row),
    state: { globalFilter, sorting, pagination },
    onGlobalFilterChange: setGlobalFilter,
    onPaginationChange: setPagination,
    globalFilterFn: 'includesString',
  });

  const rows = table.getRowModel().rows;
  const filteredCount = table.getFilteredRowModel().rows.length;
  const total = data?.length ?? 0;
  const { pageCount, searchText, onSearchTextChange } = useCollectionPaging({
    filteredCount,
    isLoading,
    globalFilter,
    setGlobalFilter,
    pagination,
    setPagination,
  });

  const grid = layout === 'grid';
  const collectionClassName = grid
    ? 'grid gap-4 sm:grid-cols-2 xl:grid-cols-3'
    : 'divide-y overflow-hidden rounded-lg border bg-card shadow-xs';

  let body: React.ReactNode;
  if (isLoading) {
    body = (
      <div aria-hidden className={collectionClassName}>
        {Array.from({ length: loadingItems ?? (grid ? 6 : 5) }, (_, index) => (
          <div
            key={index}
            data-testid="data-list-skeleton"
            className={cn('space-y-2.5 p-5', grid && 'rounded-lg border bg-card')}
          >
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-3.5 w-2/3" />
          </div>
        ))}
      </div>
    );
  } else if (rows.length === 0) {
    body = (
      <div className="rounded-lg border border-dashed">
        <CollectionEmpty
          total={total}
          emptyState={emptyState}
          noResultsState={noResultsState}
          searchText={searchText}
          onClearSearch={() => onSearchTextChange('')}
        />
      </div>
    );
  } else {
    body = (
      <ul aria-label={label} className={collectionClassName}>
        {rows.map((row) => (
          <li key={row.id} className={cn('relative min-w-0', !grid && 'hover:bg-accent/40')}>
            {renderItem(row.original)}
          </li>
        ))}
      </ul>
    );
  }

  // Nothing to search or sort yet. While loading the controls stay, so the page does not jump.
  const nothingYet = !isLoading && total === 0;
  const showSearch = !hideSearch && !nothingYet;
  const showSort = sortOptions.length > 1 && !nothingYet;
  return (
    <div data-slot="data-list" className={cn('space-y-4', className)}>
      {!showSearch && !toolbar && !showSort ? null : (
        <div className="flex flex-wrap items-center gap-2">
          {!showSearch ? null : (
            <CollectionSearch
              label={label}
              placeholder={searchPlaceholder}
              value={searchText}
              onChange={onSearchTextChange}
            />
          )}
          <div className="ml-auto flex flex-wrap items-center gap-2">
            {toolbar}
            {showSort ? (
              <Select value={activeSort?.id} onValueChange={setSortId}>
                <SelectTrigger aria-label={`Sort ${label}`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent align="end">
                  {sortOptions.map((option) => (
                    <SelectItem key={option.id} value={option.id}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : null}
          </div>
        </div>
      )}

      {body}

      {isLoading ? null : (
        <CollectionFooter
          noun={noun}
          total={total}
          filteredCount={filteredCount}
          pageCount={pageCount}
          pagination={pagination}
          pageSizeOptions={pageSizeOptions}
          onPaginationChange={setPagination}
        />
      )}
    </div>
  );
}

export { DataList };
export type { DataListProps, DataListSortOption };
