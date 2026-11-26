import { useSearchParam } from '@oakestra/dashboard-sdk';
import {
  Alert,
  AlertDescription,
  Button,
  CollectionSearch,
  EmptyState,
  Label,
  QueryErrorAlert,
  Skeleton,
  Switch,
  ToggleGroup,
  ToggleGroupItem,
  useSearchText,
} from '@oakestra/ui';
import { BoxesIcon, SearchXIcon } from 'lucide-react';
import { useDeferredValue, useId, useMemo } from 'react';

import { ClusterBoard } from './ClusterBoard';
import { Legend } from './Legend';
import { buildBoard, filterRows, parseLens, summarySentence } from './lib';
import { UpdatedAgo } from './UpdatedAgo';
import { useBoardData, type BoardData } from './use-board-data';

const LENS_LABELS = { health: 'Health', cpu: 'CPU', memory: 'Memory' };

function Loading() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" data-testid="board-loading">
      <Skeleton className="h-64" />
      <Skeleton className="h-64" />
      <Skeleton className="h-64" />
    </div>
  );
}

/**
 * The applications as cards per cluster: where each service runs, what is unplaced and what needs
 * attention. Loaded lazily by the applications page, so the list does not pay for it.
 */
export function BoardView({ onCreate }: { onCreate: () => void }) {
  const data = useBoardData();
  if (data.status === 'pending') return <Loading />;
  if (data.status === 'error') {
    return (
      <QueryErrorAlert
        title="Could not load your applications"
        error={data.error}
        onRetry={data.retry}
      />
    );
  }
  return <Loaded data={data} onCreate={onCreate} />;
}

function Loaded({ data, onCreate }: { data: BoardData; onCreate: () => void }) {
  const { entries, clusters } = data;
  const board = useMemo(() => buildBoard({ entries, clusters }), [entries, clusters]);
  const switchId = useId();

  const [lensParam, setLens] = useSearchParam('lens', 'health');
  const lens = parseLens(lensParam);
  // The list view searches the same param, so switching views keeps the query.
  const [queryParam, setQueryParam] = useSearchParam('q');
  const [query, setQuery] = useSearchText(queryParam, setQueryParam);
  // The board is not paged, so narrowing it must not hold up the field.
  const filterText = useDeferredValue(query);
  const [attentionParam, setAttentionParam] = useSearchParam('only');
  const onlyAttention = attentionParam === 'attention';

  const rows = useMemo(
    () => filterRows(board.rows, { query: filterText, onlyAttention }),
    [board.rows, filterText, onlyAttention],
  );
  const filtering = filterText.trim() !== '' || onlyAttention;
  const clearFilters = () => {
    setQuery('');
    setAttentionParam('');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="text-muted-foreground text-sm" data-testid="board-summary">
          {summarySentence(board.summary)}
        </p>
        <UpdatedAgo updatedAt={data.updatedAt} />
      </div>

      {data.stale ? (
        <Alert variant="warning" role="status">
          <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
            <span>Could not refresh, so this may be out of date.</span>
            <Button variant="outline" size="sm" onClick={data.retry}>
              Try again
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      {clusters.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          No clusters are registered yet, so nothing can run.
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {board.rows.length > 0 ? (
          <>
            <CollectionSearch
              label="applications and services"
              placeholder="Filter applications and services"
              value={query}
              onChange={setQuery}
            />
            <div className="flex items-center gap-2">
              <Switch
                id={switchId}
                checked={onlyAttention}
                onCheckedChange={(checked) => setAttentionParam(checked ? 'attention' : '')}
              />
              <Label htmlFor={switchId} className="font-normal">
                Needs attention only
              </Label>
            </div>
          </>
        ) : null}
        <ToggleGroup
          type="single"
          variant="outline"
          aria-label="What the board shows"
          className="sm:ml-auto"
          value={lens}
          // Radix reports '' when the active item is clicked again; one lens always stays on.
          onValueChange={(value) => value && setLens(value)}
        >
          {Object.entries(LENS_LABELS).map(([value, label]) => (
            <ToggleGroupItem key={value} value={value} className="flex-none px-3">
              {label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>

      {board.rows.length === 0 ? (
        <EmptyState
          icon={<BoxesIcon />}
          title="No applications yet"
          description="Once an application is deployed, its services show up on the cards of their clusters."
          action={<Button onClick={onCreate}>New application</Button>}
        />
      ) : null}

      {board.rows.length > 0 && rows.length === 0 ? (
        <EmptyState
          icon={<SearchXIcon />}
          title="Nothing matches"
          description="No application or service fits the current filter."
          action={
            <Button variant="outline" onClick={clearFilters}>
              Clear filters
            </Button>
          }
        />
      ) : (
        <ClusterBoard board={board} rows={rows} lens={lens} filtering={filtering} />
      )}

      {rows.length > 0 ? <Legend lens={lens} /> : null}
      {filtering && rows.length > 0 ? (
        <p className="sr-only" role="status">
          Showing {rows.length} of {board.rows.length} applications.
        </p>
      ) : null}
    </div>
  );
}
