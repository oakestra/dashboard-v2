import type { Instance } from '@oakestra/api';
import {
  clusterCpuPercent,
  clusterStateLabel,
  describeStatus,
  instanceHost,
  instanceProblem,
  isAbnormalTone,
  isPlacementFailure,
  parseClusterLocation,
} from '@oakestra/api';
import { useFeatureEnabled, usePermissions } from '@oakestra/dashboard-sdk';
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Button,
  formatDateTime,
  formatPercent,
  formatRelativeTime,
  plural,
  PointerGauge,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@oakestra/ui';
import { useRef, type ReactNode } from 'react';
import { Link } from 'react-router';

import {
  availableMemoryLabel,
  instanceReading,
  clusterSelection,
  instanceSelection,
  serviceRequests,
  serviceSelection,
  sortInstances,
  type ApplicationRow,
  type FleetInstance,
  type FleetModel,
  type InspectorTarget,
  type ClusterLane,
  type ServiceRow,
} from '../lib';
import { INFRASTRUCTURE_ROLES } from '../roles';
import { rowButtonClassName } from './ServiceRows';
import { Mark } from './Mark';

function Facts({ children }: { children: ReactNode }) {
  return (
    <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1.5 text-sm">{children}</dl>
  );
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  if (children === undefined || children === null || children === '') return null;
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 wrap-break-word">{children}</dd>
    </>
  );
}

function Mono({ children }: { children: ReactNode }) {
  return <span className="font-mono text-xs">{children}</span>;
}

function Heading({ children }: { children: ReactNode }) {
  return <h3 className="text-muted-foreground text-xs font-medium">{children}</h3>;
}

/** Someone else's application: the list shows it, but its pages answer 404 even for an Admin. */
function ForeignNote({ owner }: { owner: string | undefined }) {
  return (
    <p className="text-muted-foreground text-sm">
      {owner ?? 'Another user'} owns this application. Only the owner can open its pages, so this
      shows what the platform list reports.
    </p>
  );
}

function instanceRowStatus(entry: FleetInstance): string {
  return entry.stale ? 'Last known' : entry.status.label;
}

function InstanceList({
  title,
  instances,
  describe,
  label,
  onSelect,
}: {
  title: string;
  instances: readonly FleetInstance[];
  label: (entry: FleetInstance) => string;
  describe: (entry: FleetInstance) => string;
  onSelect: (selection: string) => void;
}) {
  return (
    <section className="space-y-1.5">
      <Heading>{title}</Heading>
      <ul className="divide-y rounded-lg border">
        {sortInstances(instances).map((entry) => (
          <li key={entry.key}>
            <button
              type="button"
              onClick={() =>
                onSelect(instanceSelection(entry.service._id, entry.instance.instance_number))
              }
              className={`${rowButtonClassName} min-h-11 gap-2.5 px-3 py-1.5 text-left text-sm`}
            >
              <Mark tone={entry.status.tone} stale={entry.stale} pulse={entry.status.pulse} />
              <span className="min-w-0 flex-1">
                <span className="block truncate">{label(entry)}</span>
                <span className="text-muted-foreground block truncate text-xs">
                  {describe(entry)}
                </span>
              </span>
              <span className="text-muted-foreground text-xs whitespace-nowrap">
                {instanceRowStatus(entry)}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function useClusterLink() {
  const enabled = useFeatureEnabled('infrastructure');
  const permissions = usePermissions();
  return enabled && permissions.hasAnyRole(INFRASTRUCTURE_ROLES);
}

function useCanOpenApplication(application: ApplicationRow) {
  const enabled = useFeatureEnabled('applications');
  return application.owned && enabled;
}

/** The way to the full page, or why there is none. */
function OwnedFooter({
  application,
  to,
  children,
}: {
  application: ApplicationRow;
  to: string;
  children: ReactNode;
}) {
  const canOpen = useCanOpenApplication(application);
  return (
    <>
      {application.owned ? null : <ForeignNote owner={application.owner} />}
      {canOpen ? (
        <Button asChild className="self-start">
          <Link to={to}>{children}</Link>
        </Button>
      ) : null}
    </>
  );
}

function applicationPath(application: ApplicationRow) {
  return `/applications/${application.application._id}`;
}

function servicePath(application: ApplicationRow, row: ServiceRow) {
  return `${applicationPath(application)}/services/${row.service._id}`;
}

function ServiceBody({
  application,
  row,
  fleet,
  onSelect,
}: {
  application: ApplicationRow;
  row: ServiceRow;
  fleet: FleetModel;
  onSelect: (selection: string) => void;
}) {
  const canOpen = useCanOpenApplication(application);
  const { service, exception } = row;
  const clusterName = (id: string | undefined) => fleet.lanes.find((lane) => lane.id === id)?.name;
  const placement = isPlacementFailure(service.status);
  // Only without an exception: the alert already says why a failed service has no place.
  const waiting = exception ? undefined : row.unplaced.find((entry) => entry.key === service._id);
  return (
    <>
      {exception ? (
        <Alert variant={exception.tone} role="status">
          <AlertTitle>This service {exception.summary}</AlertTitle>
          {exception.detail ? <AlertDescription>{exception.detail}</AlertDescription> : null}
          {placement && canOpen ? (
            <AlertDescription>
              <Link to={servicePath(application, row)} className="text-primary hover:underline">
                See what each cluster is missing
              </Link>
            </AlertDescription>
          ) : null}
        </Alert>
      ) : null}
      <Facts>
        <Fact label="Application">
          {canOpen ? (
            <Link to={applicationPath(application)} className="text-primary hover:underline">
              {application.application.application_name}
            </Link>
          ) : (
            application.application.application_name
          )}
        </Fact>
        {application.owned ? null : <Fact label="Owner">{application.owner ?? 'Unknown'}</Fact>}
        <Fact label="Namespace">{service.microservice_namespace}</Fact>
        <Fact label="Requests">{serviceRequests(service)}</Fact>
        <Fact label="Runtime">{service.virtualization}</Fact>
        <Fact label="Image">{service.code ? <Mono>{service.code}</Mono> : undefined}</Fact>
      </Facts>
      {waiting ? (
        <p className="text-muted-foreground text-sm">
          {waiting.tone === 'info'
            ? 'New instances show up here once the scheduler has placed them.'
            : `${waiting.label}. Nothing is running yet.`}
        </p>
      ) : null}
      {row.instances.length > 0 ? (
        <InstanceList
          title={plural(row.instances.length, 'instance')}
          instances={row.instances}
          label={(entry) => `Instance ${entry.instance.instance_number}`}
          describe={(entry) => clusterName(entry.clusterId) ?? 'Not on any cluster'}
          onSelect={onSelect}
        />
      ) : null}
      <OwnedFooter application={application} to={servicePath(application, row)}>
        Open service
      </OwnedFooter>
    </>
  );
}

function Measurement({ entry }: { entry: FleetInstance }) {
  const cpu = instanceReading([entry], 'cpu');
  const memory = instanceReading([entry], 'memory');
  return (
    <>
      <Fact label="CPU">
        {cpu ? (
          <PointerGauge size="sm" label="CPU" value={cpu.value} valueLabel={cpu.label} />
        ) : (
          <span className="text-muted-foreground">No data</span>
        )}
      </Fact>
      <Fact label="Memory">
        {memory === null ? (
          <span className="text-muted-foreground">No data</span>
        ) : memory.value === null ? (
          memory.label
        ) : (
          <>
            <PointerGauge size="sm" label="Memory" value={memory.value} valueLabel={memory.label} />
            <span className="text-muted-foreground text-xs">{memory.detail}</span>
          </>
        )}
      </Fact>
    </>
  );
}

function workerName(instance: Instance) {
  return instance.worker_id ? <Mono>{instance.worker_id}</Mono> : undefined;
}

function InstanceBody({
  application,
  row,
  entry,
  fleet,
  onSelect,
}: {
  application: ApplicationRow;
  row: ServiceRow;
  entry: FleetInstance;
  fleet: FleetModel;
  onSelect: (selection: string) => void;
}) {
  const { instance } = entry;
  const lane = fleet.lanes.find((candidate) => candidate.id === entry.clusterId);
  const problem = instanceProblem(instance);
  const host = instanceHost(instance);
  const path = `${servicePath(application, row)}/instances/${instance.instance_number}`;
  return (
    <>
      {entry.stale ? (
        <Alert role="status">
          <AlertTitle>Last known state</AlertTitle>
          <AlertDescription>
            {lane?.name ?? 'The cluster'} stopped reporting, so nobody can confirm this. Numbers are
            not shown, the last report is too old to trust.
          </AlertDescription>
        </Alert>
      ) : null}
      {problem && !entry.stale ? (
        <Alert
          variant={isAbnormalTone(entry.status.tone) ? entry.status.tone : 'default'}
          role="status"
        >
          <AlertTitle>{entry.status.label}</AlertTitle>
          <AlertDescription>{problem}</AlertDescription>
        </Alert>
      ) : null}
      <Facts>
        <Fact label="Service">
          <button
            type="button"
            onClick={() => onSelect(serviceSelection(row.service._id))}
            className="text-primary text-left hover:underline"
          >
            {application.application.application_name} / {row.service.microservice_name}
          </button>
        </Fact>
        {application.owned ? null : <Fact label="Owner">{application.owner ?? 'Unknown'}</Fact>}
        <Fact label="Cluster">
          {lane ? (
            <button
              type="button"
              onClick={() => onSelect(clusterSelection(lane.id))}
              className="text-primary text-left hover:underline"
            >
              {lane.name}
            </button>
          ) : (
            <span className="text-muted-foreground">Not on any cluster</span>
          )}
        </Fact>
        <Fact label="Worker">{workerName(instance)}</Fact>
        <Fact label="Address">{host ? <Mono>{host}</Mono> : undefined}</Fact>
        {entry.stale || entry.clusterId === undefined ? null : <Measurement entry={entry} />}
        <Fact label="Reported">
          {instance.last_modified_timestamp ? (
            <span title={formatDateTime(instance.last_modified_timestamp)}>
              {formatRelativeTime(instance.last_modified_timestamp)}
            </span>
          ) : undefined}
        </Fact>
      </Facts>
      <OwnedFooter application={application} to={path}>
        Open instance
      </OwnedFooter>
    </>
  );
}

function clusterCoordinates(location: string | undefined): string | undefined {
  const parsed = parseClusterLocation(location);
  return parsed ? `${parsed.latitude.toFixed(2)}, ${parsed.longitude.toFixed(2)}` : undefined;
}

function ClusterBody({
  lane,
  onSelect,
}: {
  lane: ClusterLane;
  onSelect: (selection: string) => void;
}) {
  const canOpen = useClusterLink();
  const { cluster, state } = lane;
  const cpu = clusterCpuPercent(cluster);
  const reporting = state === 'reporting';
  return (
    <>
      {state === 'silent' ? (
        <Alert role="status">
          <AlertDescription>
            Last report {formatRelativeTime(cluster.last_modified_timestamp)}. Its values are not
            shown here, the last report is too old to trust.
          </AlertDescription>
        </Alert>
      ) : null}
      {state === 'never-reported' ? (
        <Alert role="status">
          <AlertDescription>
            This cluster registered but has not sent a report yet.
          </AlertDescription>
        </Alert>
      ) : null}
      <Facts>
        <Fact label="Location">{clusterCoordinates(cluster.cluster_location)}</Fact>
        {reporting ? (
          <>
            <Fact label="Workers">{cluster.active_nodes ?? 0}</Fact>
            <Fact label="CPU">
              {cpu === undefined ? undefined : (
                <PointerGauge
                  size="sm"
                  label="CPU"
                  value={cpu}
                  valueLabel={formatPercent(cpu, 0)}
                />
              )}
            </Fact>
            <Fact label="Cores">{cluster.vcpus}</Fact>
            <Fact label="Memory">{availableMemoryLabel(cluster)}</Fact>
            <Fact label="Runtimes">{cluster.virtualization.join(', ')}</Fact>
          </>
        ) : null}
      </Facts>
      {lane.instances.length > 0 ? (
        <InstanceList
          title={reporting ? 'Running here' : 'Last seen here'}
          instances={lane.instances}
          label={(entry) => `${entry.applicationName} / ${entry.service.microservice_name}`}
          describe={(entry) => `Instance ${entry.instance.instance_number}`}
          onSelect={onSelect}
        />
      ) : (
        <p className="text-muted-foreground text-sm">Nothing you can see runs here.</p>
      )}
      {canOpen ? (
        <Button asChild className="self-start">
          <Link to={`/infrastructure/clusters/${lane.id}`}>Open cluster</Link>
        </Button>
      ) : null}
    </>
  );
}

interface InspectorHeading {
  kind: string;
  title: string;
  status: ReactNode;
}

function clusterStatus(lane: ClusterLane) {
  const reporting = lane.state === 'reporting';
  return (
    <Status mark={<Mark tone={reporting ? 'success' : 'neutral'} stale={!reporting} />}>
      {clusterStateLabel(lane.state)}
    </Status>
  );
}

function Status({ mark, children }: { mark: ReactNode; children: ReactNode }) {
  return (
    <span className="text-muted-foreground flex items-center gap-1.5 text-sm">
      {mark}
      {children}
    </span>
  );
}

function headingOf(target: InspectorTarget): InspectorHeading {
  if (target.kind === 'cluster') {
    return { kind: 'Cluster', title: target.lane.name, status: clusterStatus(target.lane) };
  }
  const application = target.application.application.application_name;
  const service = target.row.service.microservice_name;
  if (target.kind === 'instance') {
    const { status, stale, instance } = target.entry;
    return {
      kind: `Instance of ${application} / ${service}`,
      title: `Instance ${instance.instance_number}`,
      status: (
        <Status mark={<Mark tone={status.tone} stale={stale} pulse={status.pulse} />}>
          {stale ? `Last known: ${status.label}` : status.label}
        </Status>
      ),
    };
  }
  const own = describeStatus(target.row.service.status, target.row.service.status_detail);
  return {
    kind: `Service in ${application}`,
    title: service,
    status: <Status mark={<Mark tone={own.tone} pulse={own.pulse} />}>{own.label}</Status>,
  };
}

interface InspectorProps {
  target: InspectorTarget | null;
  fleet: FleetModel;
  onSelect: (selection: string) => void;
  onClose: () => void;
}

/**
 * Details of the selected row. A non-modal sheet: the board stays usable next to it, so walking
 * from row to row is one click each instead of close and reopen. Hence nothing on the page closes
 * it (`data-fleet-page`), only its button, Escape or leaving the page.
 */
export function Inspector({ target, fleet, onSelect, onClose }: InspectorProps) {
  const heading = target ? headingOf(target) : null;
  // Nothing triggers the sheet in Radix's sense, so it does not know where focus came from.
  const opener = useRef<HTMLElement | null>(null);

  return (
    <Sheet modal={false} open={target !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        // Without a target there is nothing left to render, so sliding out would show an empty panel.
        className="w-full gap-0 overflow-y-auto p-0 outline-none data-[state=closed]:animate-none data-[state=open]:duration-200 sm:max-w-md"
        onOpenAutoFocus={(event) => {
          opener.current = document.activeElement as HTMLElement | null;
          // The panel itself instead of the first button: a screen reader then starts at the title,
          // and a mouse click on a row does not light up the close button.
          event.preventDefault();
          (event.target as HTMLElement).focus();
        }}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          if (opener.current?.isConnected) opener.current.focus();
        }}
        onInteractOutside={(event) => {
          const element = event.target as HTMLElement | null;
          if (element?.closest('[data-fleet-page]')) event.preventDefault();
        }}
      >
        {heading && target ? (
          <>
            <SheetHeader className="gap-1 border-b p-4 pr-10">
              <SheetDescription>{heading.kind}</SheetDescription>
              <SheetTitle className="text-lg leading-6 wrap-break-word">{heading.title}</SheetTitle>
              {heading.status}
            </SheetHeader>
            <div className="flex flex-col gap-4 p-4">
              {target.kind === 'cluster' ? (
                <ClusterBody lane={target.lane} onSelect={onSelect} />
              ) : target.kind === 'instance' ? (
                <InstanceBody
                  application={target.application}
                  row={target.row}
                  entry={target.entry}
                  fleet={fleet}
                  onSelect={onSelect}
                />
              ) : (
                <ServiceBody
                  application={target.application}
                  row={target.row}
                  fleet={fleet}
                  onSelect={onSelect}
                />
              )}
            </div>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
