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
import {
  ArrowDownIcon,
  ArrowUpDownIcon,
  ArrowUpIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  InboxIcon,
  SearchIcon,
  SearchXIcon,
} from 'lucide-react';
import * as React from 'react';

import { cn } from '../lib/utils';
import { Button } from './button';
import { EmptyState } from './empty-state';
import { Input } from './input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './select';
import { Skeleton } from './skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './table';

/** Per-column presentation, set as `meta` on a column definition. */
interface DataTableColumnMeta {
  /** Horizontal alignment of the header and the cells. */
  align?: 'left' | 'center' | 'right';
  /** Right-aligns the column and uses tabular figures, so digits line up row to row. */
  numeric?: boolean;
  /** Extra classes for every body cell of the column. */
  className?: string;
  /** Extra classes for the header cell. */
  headerClassName?: string;
}

// Type-only slot of tableFeatures: its declared type types `meta` on every column, the value
// itself is stripped by TanStack at runtime.
const columnMeta: DataTableColumnMeta = {};

// Module scope on purpose: TanStack Table v9 recomputes its row models whenever the feature
// object changes identity.
export const dataTableFeatures = tableFeatures({
  columnMeta,
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

export function useControllable<T>(
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
export function useSearchText(controlled: string, onChange: (value: string) => void) {
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

/** The search box of a `DataTable` or `DataList`. */
export function CollectionSearch({
  label,
  placeholder,
  value,
  onChange,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="relative w-full sm:max-w-xs">
      <SearchIcon
        aria-hidden
        className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
      />
      <Input
        type="search"
        aria-label={`Search ${label}`}
        placeholder={placeholder}
        className="pl-9"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}

/** Result count and paging below a `DataTable` or `DataList`. */
export function CollectionFooter({
  noun,
  total,
  filteredCount,
  pageCount,
  pagination,
  pageSizeOptions,
  onPaginationChange,
}: {
  /** Singular; the page size label is built from it ("Rows per page"). */
  noun: string;
  total: number;
  filteredCount: number;
  pageCount: number;
  pagination: PaginationState;
  pageSizeOptions: readonly number[];
  onPaginationChange: (value: PaginationState) => void;
}) {
  // Without a filter or more pages, the count only restates the items on screen.
  if (filteredCount === 0 || (filteredCount === total && pageCount <= 1)) return null;
  const { pageIndex, pageSize } = pagination;
  const nouns = `${noun}s`;
  const perPage = `${nouns[0]!.toUpperCase()}${nouns.slice(1)} per page`;
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-sm text-muted-foreground">
      <span aria-live="polite" className="tabular-nums">
        {filteredCount === total
          ? `${total} ${total === 1 ? noun : nouns}`
          : `${filteredCount} of ${total} ${total === 1 ? noun : nouns}`}
      </span>
      {pageCount > 1 || filteredCount > (pageSizeOptions[0] ?? 10) ? (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <div className="flex items-center gap-2">
            <span className="hidden sm:inline">{perPage}</span>
            <Select
              value={String(pageSize)}
              onValueChange={(value) =>
                onPaginationChange({ pageIndex: 0, pageSize: Number(value) })
              }
            >
              <SelectTrigger size="sm" aria-label={perPage} className="tabular-nums">
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
          <span className="tabular-nums">
            Page {pageIndex + 1} of {pageCount}
          </span>
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="sm"
              disabled={pageIndex <= 0}
              onClick={() => onPaginationChange({ ...pagination, pageIndex: pageIndex - 1 })}
            >
              <ChevronLeftIcon aria-hidden />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={pageIndex >= pageCount - 1}
              onClick={() => onPaginationChange({ ...pagination, pageIndex: pageIndex + 1 })}
            >
              Next
              <ChevronRightIcon aria-hidden />
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function alignOf(meta: DataTableColumnMeta | undefined) {
  return meta?.align ?? (meta?.numeric ? 'right' : 'left');
}

const ALIGN_CLASS = { left: '', center: 'text-center', right: 'text-right' } as const;
const SKELETON_WIDTHS = ['w-32', 'w-20', 'w-24', 'w-16', 'w-28'];

function isInteractive(target: EventTarget | null, row: Element) {
  if (!(target instanceof Element)) return false;
  // React events bubble through portals, so a click inside a dropdown or dialog opened from a
  // cell reaches the row although its DOM node lives elsewhere. Such clicks never mean "open row".
  if (!row.contains(target)) return true;
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

  const [searchText, onSearchTextChange] = useSearchText(globalFilter, (value) => {
    setGlobalFilter(value);
    // Results shrink under the user; keep them from landing on an empty page.
    setPagination((previous) => ({ ...previous, pageIndex: 0 }));
  });

  let body: React.ReactNode;
  if (isLoading) {
    const leafHeaders = table.getHeaderGroups().at(-1)?.headers ?? [];
    body = Array.from({ length: loadingRows }, (_, row) => (
      <TableRow key={row} data-testid="data-table-skeleton-row" className="hover:bg-transparent">
        {Array.from({ length: columnCount }, (_, cell) => (
          <TableCell
            key={cell}
            className={ALIGN_CLASS[alignOf(leafHeaders[cell]?.column.columnDef.meta)]}
          >
            <Skeleton
              className={cn(
                'inline-block h-4 max-w-full align-middle',
                SKELETON_WIDTHS[(row + cell) % SKELETON_WIDTHS.length],
              )}
            />
          </TableCell>
        ))}
      </TableRow>
    ));
  } else if (rows.length === 0) {
    body = (
      <TableRow className="hover:bg-transparent">
        <TableCell colSpan={columnCount}>
          {total === 0
            ? (emptyState ?? <EmptyState icon={<InboxIcon />} title="Nothing here yet" />)
            : (noResultsState ?? (
                <EmptyState
                  icon={<SearchXIcon />}
                  title="No results"
                  description="Nothing matches your search. Try a different term."
                  action={
                    searchText ? (
                      <Button variant="outline" size="sm" onClick={() => onSearchTextChange('')}>
                        Clear search
                      </Button>
                    ) : undefined
                  }
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
          data-clickable={clickable || undefined}
          className={cn(
            clickable &&
              'cursor-pointer outline-none focus-visible:bg-muted/60 focus-visible:shadow-[inset_2px_0_0_var(--ring)]',
          )}
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
          {row.getAllCells().map((cell) => {
            const meta = cell.column.columnDef.meta;
            return (
              <TableCell
                key={cell.id}
                className={cn(
                  ALIGN_CLASS[alignOf(meta)],
                  meta?.numeric && 'tabular-nums',
                  meta?.className,
                )}
              >
                <table.FlexRender cell={cell} />
              </TableCell>
            );
          })}
        </TableRow>
      );
    });
  }

  return (
    <div data-slot="data-table" className={cn('space-y-3', className)}>
      {hideSearch && !toolbar ? null : (
        <div className="flex flex-wrap items-center gap-2">
          {hideSearch ? null : (
            <CollectionSearch
              label={label}
              placeholder={searchPlaceholder}
              value={searchText}
              onChange={onSearchTextChange}
            />
          )}
          {toolbar ? (
            <div className="ml-auto flex flex-wrap items-center gap-2">{toolbar}</div>
          ) : null}
        </div>
      )}

      <div className="overflow-hidden rounded-lg border bg-card">
        <Table aria-label={label}>
          <TableHeader className="bg-muted/60">
            {table.getHeaderGroups().map((group) => (
              <TableRow key={group.id} className="hover:bg-transparent">
                {group.headers.map((header) => {
                  const sorted = header.column.getIsSorted();
                  const canSort = header.column.getCanSort();
                  const meta = header.column.columnDef.meta;
                  const align = alignOf(meta);
                  return (
                    <TableHead
                      key={header.id}
                      colSpan={header.colSpan}
                      className={cn(ALIGN_CLASS[align], meta?.headerClassName)}
                      aria-sort={
                        sorted === 'asc'
                          ? 'ascending'
                          : sorted === 'desc'
                            ? 'descending'
                            : undefined
                      }
                    >
                      {header.isPlaceholder ? null : canSort ? (
                        // The idle sort icon only shows on hover or focus: one on every header
                        // is noise. Its space is kept so the label does not shift.
                        <button
                          type="button"
                          className={cn(
                            'group/sort -mx-1.5 inline-flex h-7 items-center gap-1 rounded-md px-1.5 font-medium outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/30 data-[sorted=true]:text-foreground [&_svg]:size-3.5 [&_svg]:shrink-0',
                            align === 'right' && 'flex-row-reverse',
                          )}
                          data-sorted={sorted !== false}
                          onClick={header.column.getToggleSortingHandler()}
                        >
                          <table.FlexRender header={header} />
                          {sorted === 'asc' ? (
                            <ArrowUpIcon aria-hidden />
                          ) : sorted === 'desc' ? (
                            <ArrowDownIcon aria-hidden />
                          ) : (
                            <ArrowUpDownIcon
                              aria-hidden
                              className="opacity-0 transition-opacity group-hover/sort:opacity-60 group-focus-visible/sort:opacity-60"
                            />
                          )}
                        </button>
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

      {isLoading ? null : (
        <CollectionFooter
          noun="row"
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

export { DataTable, createDataTableColumnHelper };
export type { DataTableColumnDef, DataTableColumnMeta, DataTableProps };
