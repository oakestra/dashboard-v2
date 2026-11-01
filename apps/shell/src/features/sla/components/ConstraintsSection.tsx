import type { Cluster } from '@oakestra/api';
import { useOakestraApi } from '@oakestra/dashboard-sdk';
import {
  Alert,
  AlertDescription,
  Button,
  Checkbox,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Field,
  FieldError,
  FieldLabel,
  Label,
} from '@oakestra/ui';
import { useQuery } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import { Controller, useFieldArray, useFormContext, useWatch } from 'react-hook-form';

import { LocationMap } from '../../../components/LocationMap';
import { clustersQuery } from '../../infrastructure';
import { defaultConstraint, type ServiceFormValues } from '../model/schema';
import { count, FormSelect, Section, TextField, useFieldError } from './fields';

function RigidnessFields({ prefix }: { prefix: `constraints.${number}` }) {
  return (
    <>
      <TextField
        name={`${prefix}.rigidness`}
        label="Rigidness"
        inputMode="decimal"
        description="0 to 1. 1 triggers on the first violation, 0.9 tolerates 10%."
      />
      <TextField
        name={`${prefix}.convergence_time`}
        label="Convergence time (s)"
        inputMode="numeric"
        description="Time the scheduler gets before the constraint is measured."
      />
    </>
  );
}

function GeoMap({ index }: { index: number }) {
  const [latitude, longitude, threshold] = useWatch<ServiceFormValues>({
    name: [
      `constraints.${index}.latitude`,
      `constraints.${index}.longitude`,
      `constraints.${index}.threshold`,
    ] as never,
  }) as [string, string, string];
  const lat = Number(latitude);
  const lng = Number(longitude);
  if (
    !latitude?.trim() ||
    !longitude?.trim() ||
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    Math.abs(lat) > 90 ||
    Math.abs(lng) > 180
  ) {
    return null;
  }
  const radius = Number(threshold);
  return (
    <LocationMap
      ariaLabel="Preferred location"
      className="h-56 w-full"
      locations={[
        {
          lat,
          lng,
          ...(Number.isFinite(radius) && radius > 0 ? { radiusKm: radius } : {}),
          label: 'Preferred location',
        },
      ]}
    />
  );
}

function ClusterPicker({ index, clusters }: { index: number; clusters: Cluster[] | undefined }) {
  const { control } = useFormContext<ServiceFormValues>();
  const error = useFieldError(`constraints.${index}.allowed`);
  return (
    <Controller
      control={control}
      name={`constraints.${index}.allowed`}
      render={({ field }) => {
        const selected = (field.value as string[] | undefined) ?? [];
        // Keep names that are no longer registered (imported files) selectable so they can be removed.
        const names = [...new Set([...(clusters?.map((c) => c.cluster_name) ?? []), ...selected])];
        return (
          <Field data-invalid={!!error}>
            <FieldLabel>Allowed clusters</FieldLabel>
            <div className="flex flex-wrap gap-x-6 gap-y-2">
              {names.map((name) => (
                <div key={name} className="flex items-center gap-2">
                  <Checkbox
                    id={`sla-cluster-${index}-${name}`}
                    checked={selected.includes(name)}
                    onCheckedChange={(checked) =>
                      field.onChange(
                        checked ? [...selected, name] : selected.filter((item) => item !== name),
                      )
                    }
                  />
                  <Label htmlFor={`sla-cluster-${index}-${name}`}>{name}</Label>
                </div>
              ))}
            </div>
            <FieldError errors={[error]} />
          </Field>
        );
      }}
    />
  );
}

function DirectFields({ index, clusters }: { index: number; clusters: Cluster[] | undefined }) {
  const clusterError = useFieldError(`constraints.${index}.cluster`);
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field data-invalid={!!clusterError}>
        <FieldLabel htmlFor={`sla-direct-cluster-${index}`}>Cluster</FieldLabel>
        <FormSelect
          id={`sla-direct-cluster-${index}`}
          name={`constraints.${index}.cluster`}
          invalid={!!clusterError}
          placeholder="Select a cluster"
          options={(clusters ?? []).map((cluster) => ({
            value: cluster.cluster_name,
            label: cluster.cluster_name,
          }))}
        />
        <FieldError errors={[clusterError]} />
      </Field>
      <TextField
        name={`constraints.${index}.node`}
        label="Node"
        description="Hostname of the worker node."
      />
    </div>
  );
}

const HINTS = {
  latency: 'Stay within N ms of an area',
  geo: 'Stay within N km of a point',
  clusters: 'Pick the clusters that may run it',
  direct: 'Pin it to one cluster and node',
} as const;

const TITLES = {
  latency: 'Latency',
  geo: 'Geo',
  clusters: 'Cluster list',
  direct: 'Specific node',
  other: 'Other',
} as const;

export function ConstraintsSection({ hasError }: { hasError: boolean }) {
  const api = useOakestraApi();
  const { control } = useFormContext<ServiceFormValues>();
  const { fields, append, remove } = useFieldArray({ control, name: 'constraints' });
  const clusters = useQuery(clustersQuery(api));

  return (
    <Section
      id="constraints"
      title="Constraints"
      description="Where the scheduler may place the service."
      collapsible
      defaultOpen={fields.length > 0}
      summary={count(fields.length, 'constraint')}
      hasError={hasError}
    >
      {clusters.isError ? (
        <Alert variant="destructive">
          <AlertDescription>
            Could not load the clusters, so cluster constraints cannot be picked from a list.
          </AlertDescription>
        </Alert>
      ) : null}
      <div className="space-y-4">
        {fields.map((item, index) => (
          <div key={item.id} className="space-y-4 rounded-lg border p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium">{TITLES[item.kind]} constraint</h3>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`Remove ${TITLES[item.kind].toLowerCase()} constraint`}
                onClick={() => remove(index)}
              >
                <Trash2 />
              </Button>
            </div>
            {item.kind === 'latency' ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <TextField name={`constraints.${index}.area`} label="Area" placeholder="munich-1" />
                <TextField
                  name={`constraints.${index}.threshold`}
                  label="Maximum latency (ms)"
                  inputMode="decimal"
                />
                <RigidnessFields prefix={`constraints.${index}`} />
              </div>
            ) : null}
            {item.kind === 'geo' ? (
              <div className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <TextField
                    name={`constraints.${index}.latitude`}
                    label="Latitude"
                    inputMode="decimal"
                  />
                  <TextField
                    name={`constraints.${index}.longitude`}
                    label="Longitude"
                    inputMode="decimal"
                  />
                  <TextField
                    name={`constraints.${index}.threshold`}
                    label="Maximum distance (km)"
                    inputMode="decimal"
                  />
                  <RigidnessFields prefix={`constraints.${index}`} />
                </div>
                <GeoMap index={index} />
              </div>
            ) : null}
            {item.kind === 'clusters' ? (
              <ClusterPicker index={index} clusters={clusters.data} />
            ) : null}
            {item.kind === 'direct' ? (
              <DirectFields index={index} clusters={clusters.data} />
            ) : null}
            {item.kind === 'other' ? (
              <pre className="bg-muted overflow-x-auto rounded-md p-3 text-xs">
                {JSON.stringify(item.raw, null, 2)}
              </pre>
            ) : null}
          </div>
        ))}
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="outline" size="sm">
            <Plus /> Add constraint
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          {(['latency', 'geo', 'clusters', 'direct'] as const).map((kind) => (
            <DropdownMenuItem key={kind} onSelect={() => append(defaultConstraint(kind))}>
              <span>
                {TITLES[kind]}
                <span className="block text-xs text-muted-foreground">{HINTS[kind]}</span>
              </span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </Section>
  );
}
