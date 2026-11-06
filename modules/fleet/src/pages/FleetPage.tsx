import { useFeatureEnabled, usePermissions, useSearchParam } from '@oakestra/dashboard-sdk';
import {
  Alert,
  AlertDescription,
  Button,
  cn,
  CollectionSearch,
  EmptyState,
  Label,
  PageHeader,
  QueryErrorAlert,
  Skeleton,
  Switch,
  ToggleGroup,
  ToggleGroupItem,
  useSearchText,
} from '@oakestra/ui';
import { BoxesIcon, SearchXIcon } from 'lucide-react';
import { useDeferredValue, useMemo } from 'react';
import { Link } from 'react-router';

import { ExceptionsList } from '../components/ExceptionsList';
import { FleetBoard } from '../components/FleetBoard';
import { Inspector } from '../components/Inspector';
import { Legend } from '../components/Legend';
import { UpdatedAgo } from '../components/UpdatedAgo';
import { buildFleet, filterRows, parseLens, resolveSelection, summarySentence } from '../lib';
import { APPLICATION_ROLES } from '../roles';
import { useFleetData, type FleetData } from '../use-fleet-data';

const LENS_LABELS = { health: 'Health', cpu: 'CPU', memory: 'Memory' };

function NoApplications({ scope }: { scope: FleetData['scope'] }) {
  const applicationsEnabled = useFeatureEnabled('applications');
  const canCreate = usePermissions().hasAnyRole(APPLICATION_ROLES);
  return (
    <EmptyState
      icon={<BoxesIcon />}
      title={scope === 'all' ? 'No applications yet' : 'You have no applications'}
      description="This view places applications on clusters. Once one is deployed, its services show up on the cards of their clusters."
      action={
        applicationsEnabled && canCreate ? (
          <Button asChild>
            <Link to="/applications">New application</Link>
          </Button>
        ) : undefined
      }
    />
  );
}

function Loading() {
  return (
    <div className="space-y-6" data-testid="fleet-loading">
      <Skeleton className="h-32 w-full" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Skeleton className="h-64" />
        <Skeleton className="h-64" />
        <Skeleton className="h-64" />
      </div>
    </div>
  );
}

export function FleetPage() {
  const data = useFleetData();
  return (
    <div className="space-y-6">
      {data.status === 'pending' ? (
        <>
          <PageHeader title="Fleet" />
          <Loading />
        </>
      ) : data.status === 'error' ? (
        <>
          <PageHeader title="Fleet" />
          <QueryErrorAlert
            title="Could not load the fleet"
            error={data.error}
            onRetry={data.retry}
          />
        </>
      ) : (
        <Loaded data={data} />
      )}
    </div>
  );
}

function Loaded({ data }: { data: FleetData }) {
  const { entries, clusters, scope, username } = data;
  const fleet = useMemo(
    () => buildFleet({ entries, clusters, scope, username }),
    [entries, clusters, scope, username],
  );

  const [lensParam, setLens] = useSearchParam('lens', 'health');
  const lens = parseLens(lensParam);
  const [queryParam, setQueryParam] = useSearchParam('q');
  const [query, setQuery] = useSearchText(queryParam, setQueryParam);
  // The board is not paged, so narrowing it must not hold up the field.
  const filterText = useDeferredValue(query);
  const [exceptionsParam, setExceptionsParam] = useSearchParam('only');
  const onlyExceptions = exceptionsParam === 'exceptions';
  const [selection, setSelection] = useSearchParam('select');

  const rows = useMemo(
    () => filterRows(fleet.rows, { query: filterText, onlyExceptions }),
    [fleet.rows, filterText, onlyExceptions],
  );
  const target = selection ? resolveSelection(fleet, selection) : null;
  const filtering = filterText.trim() !== '' || onlyExceptions;
  const clearFilters = () => {
    setQuery('');
    setExceptionsParam('');
  };

  return (
    <div
      data-fleet-page
      className={cn(
        'space-y-6',
        // The inspector covers the right edge. From this width on there is room to keep the
        // selected row in view instead; the padding is its width minus the page gutter, plus a gutter of its own.
        target && 'xl:pr-[27.5rem]',
      )}
    >
      <PageHeader
        title="Fleet"
        description={<span data-testid="fleet-summary">{summarySentence(fleet.summary)}</span>}
        actions={<UpdatedAgo updatedAt={data.updatedAt} />}
      />

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

      <ExceptionsList exceptions={fleet.exceptions} onSelect={setSelection} />

      {clusters.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          No clusters are registered yet, so nothing can run.
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {fleet.rows.length > 0 ? (
          <>
            <CollectionSearch
              label="applications and services"
              placeholder="Filter applications and services"
              value={query}
              onChange={setQuery}
            />
            <div className="flex items-center gap-2">
              <Switch
                id="fleet-only-exceptions"
                checked={onlyExceptions}
                onCheckedChange={(checked) => setExceptionsParam(checked ? 'exceptions' : '')}
              />
              <Label htmlFor="fleet-only-exceptions" className="font-normal">
                Only exceptions
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

      {fleet.rows.length === 0 ? <NoApplications scope={scope} /> : null}

      {fleet.rows.length > 0 && rows.length === 0 ? (
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
        <FleetBoard
          fleet={fleet}
          rows={rows}
          lens={lens}
          selection={selection}
          filtering={filtering}
          onSelect={setSelection}
        />
      )}

      {rows.length > 0 ? <Legend lens={lens} /> : null}
      {filtering && rows.length > 0 ? (
        <p className="sr-only" role="status">
          Showing {rows.length} of {fleet.rows.length} applications.
        </p>
      ) : null}

      <Inspector
        target={target}
        fleet={fleet}
        onSelect={setSelection}
        onClose={() => setSelection('')}
      />
    </div>
  );
}
