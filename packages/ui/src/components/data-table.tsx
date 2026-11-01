import {
  columnFilteringFeature,
  createColumnHelper,
  createFilteredRowModel,
  createPaginatedRowModel,
  createSortedRowModel,
  filterFn_includesString,
  globalFilteringFeature,
  rowPaginationFeature,
  rowSortingFeature,
  sortFn_alphanumeric,
  sortFn_basic,
  sortFn_datetime,
  sortFn_text,
  tableFeatures,
  useTable,
  type ColumnDef,
  type PaginationState,
  type SortingState,
} from '@tanstack/react-table';
import { ArrowDownIcon, ArrowUpDownIcon, ArrowUpIcon, SearchIcon } from 'lucide-react';
import * as React from 'react';

import { cn } from '../lib/utils';
import { Button } from './button';
import { EmptyState } from './empty-state';
import { Input } from './input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './select';
import { Skeleton } from './skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './table';

// Module scope on purpose: TanStack Table v9 recomputes its row models whenever the feature
// object changes identity.
const dataTableFeatures = tableFeatures({
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
  sortFns: {
    alphanumeric: sortFn_alphanumeric,
    basic: sortFn_basic,
    datetime: sortFn_datetime,
    text: sortFn_text,
  },
  columnFilteringFeature,
  globalFilteringFeature,
  filteredRowModel: createFilteredRowModel(),
  filterFns: { includesString: filterFn_includesString },
  rowPaginationFeature,
  paginatedRowModel: createPaginatedRowModel(),
});

type DataTableFeatures = typeof dataTableFeatures;

// `any` for the cell value: a column list mixes accessors with different value types, which a
// single TValue cannot describe. Per-column types are still inferred by the column helper.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DataTableColumnDef<TData extends object> = ColumnDef<DataTableFeatures, TData, any>;

/** Typed column builder: `const col = createDataTableColumnHelper<App>(); col.accessor('name', {...})`. */
function createDataTableColumnHelper<TData extends object>() {
  return createColumnHelper<DataTableFeatures, TData>();
}

const DEFAULT_PAGE_SIZES = [10, 25, 50, 100];
const emptyRows: never[] = [];

interface DataTableProps<TData extends object> {
  columns: readonly DataTableColumnDef<TData>[];
  data: readonly TData[] | undefined;
  /** Stable row ids keep focus and selection across refetches; defaults to the row index. */
  getRowId?: (row: TData, index: number) => string;
  /** Renders skeleton rows instead of data; use for the first load (`query.isPending`). */
  isLoading?: boolean;
  loadingRows?: number;
  /** Shown when `data` is empty. Defaults to a plain "Nothing here yet" state. */
  emptyState?: React.ReactNode;
  /** Shown when the filter matches nothing. */
  noResultsState?: React.ReactNode;
  /** Clicks on links, buttons and inputs inside the row do not trigger this. */
  onRowClick?: (row: TData) => void;
  /** Extra controls rendered next to the search box (filters, create button). */
  toolbar?: React.ReactNode;
  /** Hides the built-in search input; the global filter state still works if controlled. */
  hideSearch?: boolean;
  searchPlaceholder?: string;
  /** Accessible name for the table and the search box. */
  label: string;
  pageSizeOptions?: readonly number[];
  className?: string;

  // Each piece of state is uncontrolled unless its value is passed. Pass value and change
  // handler together to mirror it into URL search params.
  globalFilter?: string;
  onGlobalFilterChange?: (value: string) => void;
  sorting?: SortingState;
  onSortingChange?: (value: SortingState) => void;
  pagination?: PaginationState;
  onPaginationChange?: (value: PaginationState) => void;
  initialSorting?: SortingState;
  initialPageSize?: number;
}

function useControllable<T>(
  controlled: T | undefined,
  initial: T,
  onChange: ((value: T) => void) | undefined,
) {
  const [internal, setInternal] = React.useState(initial);
  const value = controlled ?? internal;

  // Accepts both values and updater functions, like React's setState, because TanStack calls it
  // with updaters.
  const set = React.useCallback(
    (updater: T | ((previous: T) => T)) => {
      const next = typeof updater === 'function' ? (updater as (p: T) => T)(value) : updater;
      if (controlled === undefined) setInternal(next);
      onChange?.(next);
    },
    [value, controlled, onChange],
  );

  return [value, set] as const;
}

/**
 * Text of the search box. The box must not be bound straight to a `globalFilter` that lives in
 * the URL: the router applies location changes asynchronously, so a keystroke typed before the
 * previous one came back would be rendered over with the stale value and lost. The box keeps its
 * own text, and the controlled value only replaces it when it changes for a reason other than
 * what was typed here (back navigation, a link with `?q=`).
 */
function useSearchText(controlled: string, onChange: (value: string) => void) {
  const [text, setText] = React.useState(controlled);
  // Values sent up that the controlled value has not echoed yet, oldest first.
  const pending = React.useRef<string[]>([]);

  React.useEffect(() => {
    const echoed = pending.current.indexOf(controlled);
    if (echoed >= 0) {
      pending.current = pending.current.slice(echoed + 1);
      return;
    }
    pending.current = [];
    setText(controlled);
  }, [controlled]);

  const update = (value: string) => {
    pending.current.push(value);
    setText(value);
    onChange(value);
  };
  return [text, update] as const;
}

function isInteractive(target: EventTarget | null, row: Element) {
  if (!(target instanceof Element)) return false;
  const interactive = target.closest('a, button, input, select, textarea, [role="menuitem"]');
  return interactive !== null && row.contains(interactive);
}

function DataTable<TData extends object>({
  columns,
  data,
  getRowId,
  isLoading = false,
  loadingRows = 5,
  emptyState,
  noResultsState,
  onRowClick,
  toolbar,
  hideSearch = false,
  searchPlaceholder = 'Search...',
  label,
  pageSizeOptions = DEFAULT_PAGE_SIZES,
  className,
  globalFilter: globalFilterProp,
  onGlobalFilterChange,
  sorting: sortingProp,
  onSortingChange,
  pagination: paginationProp,
  onPaginationChange,
  initialSorting,
  initialPageSize,
}: DataTableProps<TData>) {
  const [globalFilter, setGlobalFilter] = useControllable(
    globalFilterProp,
    '',
    onGlobalFilterChange,
  );
  const [sorting, setSorting] = useControllable<SortingState>(
    sortingProp,
    initialSorting ?? [],
    onSortingChange,
  );
  const [pagination, setPagination] = useControllable<PaginationState>(
    paginationProp,
    { pageIndex: 0, pageSize: initialPageSize ?? pageSizeOptions[0] ?? 10 },
    onPaginationChange,
  );

  const table = useTable({
    features: dataTableFeatures,
    columns,
    data: data ?? emptyRows,
    getRowId,
    state: { globalFilter, sorting, pagination },
    onGlobalFilterChange: setGlobalFilter,
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    globalFilterFn: 'includesString',
  });

  const rows = table.getRowModel().rows;
  const filteredCount = table.getFilteredRowModel().rows.length;
  const total = data?.length ?? 0;
  const pageCount = Math.max(1, Math.ceil(filteredCount / pagination.pageSize));
  const pageIndex = pagination.pageIndex;
  // A controlled page index can outlive the data that justified it (e.g. a stale URL param).
  const outOfRange = !isLoading && pageIndex > pageCount - 1;
  React.useEffect(() => {
    if (outOfRange) setPagination((previous) => ({ ...previous, pageIndex: pageCount - 1 }));
  }, [outOfRange, pageCount, setPagination]);
  const columnCount = columns.length;

  const searchId = React.useId();
  const [searchText, onSearchTextChange] = useSearchText(globalFilter, (value) => {
    setGlobalFilter(value);
    // Results shrink under the user; keep them from landing on an empty page.
    setPagination((previous) => ({ ...previous, pageIndex: 0 }));
  });

  let body: React.ReactNode;
  if (isLoading) {
    body = Array.from({ length: loadingRows }, (_, row) => (
      <TableRow key={row} data-testid="data-table-skeleton-row">
        {Array.from({ length: columnCount }, (_, cell) => (
          <TableCell key={cell}>
            <Skeleton className="h-4 w-full max-w-40" />
          </TableCell>
        ))}
      </TableRow>
    ));
  } else if (rows.length === 0) {
    body = (
      <TableRow className="hover:bg-transparent">
        <TableCell colSpan={columnCount}>
          {total === 0
            ? (emptyState ?? <EmptyState title="Nothing here yet" />)
            : (noResultsState ?? (
                <EmptyState
                  title="No results"
                  description="Nothing matches your search. Try a different term."
                />
              ))}
        </TableCell>
      </TableRow>
    );
  } else {
    body = rows.map((row) => {
      const clickable = onRowClick !== undefined;
      return (
        <TableRow
          key={row.id}
          className={cn(clickable && 'cursor-pointer')}
          tabIndex={clickable ? 0 : undefined}
          onClick={
            clickable
              ? (event) => {
                  if (!isInteractive(event.target, event.currentTarget)) onRowClick(row.original);
                }
              : undefined
          }
          onKeyDown={
            clickable
              ? (event) => {
                  if (event.key === 'Enter' && event.target === event.currentTarget) {
                    onRowClick(row.original);
                  }
                }
              : undefined
          }
        >
          {row.getAllCells().map((cell) => (
            <TableCell key={cell.id}>
              <table.FlexRender cell={cell} />
            </TableCell>
          ))}
        </TableRow>
      );
    });
  }

  return (
    <div data-slot="data-table" className={cn('space-y-3', className)}>
      {hideSearch && !toolbar ? null : (
        <div className="flex flex-wrap items-center gap-2">
          {hideSearch ? null : (
            <div className="relative w-full max-w-xs">
              <SearchIcon
                aria-hidden
                className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                id={searchId}
                type="search"
                aria-label={`Search ${label}`}
                placeholder={searchPlaceholder}
                className="pl-8"
                value={searchText}
                onChange={(event) => onSearchTextChange(event.target.value)}
              />
            </div>
          )}
          {toolbar ? (
            <div className="ml-auto flex flex-wrap items-center gap-2">{toolbar}</div>
          ) : null}
        </div>
      )}

      <div className="rounded-md border">
        <Table aria-label={label}>
          <TableHeader>
            {table.getHeaderGroups().map((group) => (
              <TableRow key={group.id} className="hover:bg-transparent">
                {group.headers.map((header) => {
                  const sorted = header.column.getIsSorted();
                  const canSort = header.column.getCanSort();
                  return (
                    <TableHead
                      key={header.id}
                      colSpan={header.colSpan}
                      aria-sort={
                        sorted === 'asc'
                          ? 'ascending'
                          : sorted === 'desc'
                            ? 'descending'
                            : undefined
                      }
                    >
                      {header.isPlaceholder ? null : canSort ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="-ml-3 h-8 data-[sorted=true]:text-foreground"
                          data-sorted={sorted !== false}
                          onClick={header.column.getToggleSortingHandler()}
                        >
                          <table.FlexRender header={header} />
                          {sorted === 'asc' ? (
                            <ArrowUpIcon aria-hidden />
                          ) : sorted === 'desc' ? (
                            <ArrowDownIcon aria-hidden />
                          ) : (
                            <ArrowUpDownIcon aria-hidden className="opacity-50" />
                          )}
                        </Button>
                      ) : (
                        <table.FlexRender header={header} />
                      )}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>{body}</TableBody>
        </Table>
      </div>

      {!isLoading && filteredCount > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
          <span aria-live="polite">
            {filteredCount === total
              ? `${total} ${total === 1 ? 'row' : 'rows'}`
              : `${filteredCount} of ${total} ${total === 1 ? 'row' : 'rows'}`}
          </span>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span>Rows per page</span>
              <Select
                value={String(pagination.pageSize)}
                onValueChange={(value) => setPagination({ pageIndex: 0, pageSize: Number(value) })}
              >
                <SelectTrigger size="sm" aria-label="Rows per page">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {pageSizeOptions.map((size) => (
                    <SelectItem key={size} value={String(size)}>
                      {size}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <span>
              Page {pageIndex + 1} of {pageCount}
            </span>
            <div className="flex gap-1">
              <Button
                variant="outline"
                size="sm"
                disabled={pageIndex <= 0}
                onClick={() => setPagination({ ...pagination, pageIndex: pageIndex - 1 })}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={pageIndex >= pageCount - 1}
                onClick={() => setPagination({ ...pagination, pageIndex: pageIndex + 1 })}
              >
                Next
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export { DataTable, createDataTableColumnHelper };
export type { DataTableColumnDef, DataTableProps };
