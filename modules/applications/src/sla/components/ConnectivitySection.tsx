import { servicesByApplicationQuery, useOakestraApi } from '@oakestra/dashboard-sdk';
import { Button, Field, FieldError, FieldLabel } from '@oakestra/ui';
import { useQuery } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import { useFieldArray, useFormContext } from 'react-hook-form';

import {
  DEFAULT_CONVERGENCE_TIME,
  DEFAULT_RIGIDNESS,
  type ServiceFormValues,
} from '../model/schema';
import { count, FormSelect, Section, TextField, useFieldError } from './fields';

interface Target {
  id: string;
  label: string;
}

const CONSTRAINT_TYPES = [
  { value: 'latency', label: 'Latency (ms)' },
  { value: 'bandwidth', label: 'Bandwidth (kbit/s)' },
];

function ConnectivityConstraints({ linkIndex }: { linkIndex: number }) {
  const { control } = useFormContext<ServiceFormValues>();
  const { fields, append, remove } = useFieldArray({
    control,
    name: `connectivity.${linkIndex}.constraints`,
  });
  return (
    <div className="space-y-3">
      {fields.map((item, index) => {
        const prefix = `connectivity.${linkIndex}.constraints.${index}` as const;
        return (
          <div key={item.id} className="flex flex-wrap items-start gap-2">
            <Field className="w-36">
              <FieldLabel htmlFor={`sla-conn-${linkIndex}-${index}-type`}>Type</FieldLabel>
              <FormSelect
                id={`sla-conn-${linkIndex}-${index}-type`}
                name={`${prefix}.type`}
                options={CONSTRAINT_TYPES}
              />
            </Field>
            <TextField name={`${prefix}.threshold`} label="Threshold" className="w-32" />
            <TextField name={`${prefix}.rigidness`} label="Rigidness" className="w-28" />
            <TextField
              name={`${prefix}.convergence_time`}
              label="Convergence (s)"
              className="w-36"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="mt-6"
              aria-label={`Remove connection constraint ${index + 1}`}
              onClick={() => remove(index)}
            >
              <Trash2 />
            </Button>
          </div>
        );
      })}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() =>
          append({
            type: 'latency',
            threshold: '',
            rigidness: DEFAULT_RIGIDNESS,
            convergence_time: DEFAULT_CONVERGENCE_TIME,
          })
        }
      >
        <Plus /> Add constraint
      </Button>
    </div>
  );
}

function LinkTarget({ index, targets }: { index: number; targets: Target[] }) {
  const { getValues } = useFormContext<ServiceFormValues>();
  const error = useFieldError(`connectivity.${index}.target`);
  const current = getValues(`connectivity.${index}.target`);
  // An imported target that is not (or no longer) in this application stays visible.
  const options =
    targets.some((t) => t.id === current) || !current
      ? targets
      : [...targets, { id: current, label: current }];
  return (
    <Field data-invalid={!!error}>
      <FieldLabel htmlFor={`sla-conn-${index}-target`}>Target service</FieldLabel>
      <FormSelect
        id={`sla-conn-${index}-target`}
        name={`connectivity.${index}.target`}
        invalid={!!error}
        placeholder="Select a service"
        options={options.map((target) => ({ value: target.id, label: target.label }))}
      />
      <FieldError errors={[error]} />
    </Field>
  );
}

export function ConnectivitySection({ applicationId }: { applicationId: string }) {
  const api = useOakestraApi();
  const { control } = useFormContext<ServiceFormValues>();
  const { fields, append, remove } = useFieldArray({ control, name: 'connectivity' });
  const services = useQuery(servicesByApplicationQuery(api, applicationId));
  const targets: Target[] = (services.data ?? []).map((service) => ({
    id: service._id,
    label: `${service.microservice_name}.${service.microservice_namespace}`,
  }));

  return (
    <Section
      id="connectivity"
      title="Connectivity"
      description="Latency or bandwidth the service needs towards other services of this application."
      collapsible
      defaultOpen={fields.length > 0}
      summary={count(fields.length, 'connection')}
    >
      <div className="space-y-4">
        {fields.map((item, index) => (
          <div key={item.id} className="space-y-4 rounded-lg border p-4">
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <LinkTarget index={index} targets={targets} />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`Remove connection ${index + 1}`}
                onClick={() => remove(index)}
              >
                <Trash2 />
              </Button>
            </div>
            <ConnectivityConstraints linkIndex={index} />
          </div>
        ))}
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => append({ target: '', constraints: [] })}
      >
        <Plus /> Add connection
      </Button>
    </Section>
  );
}
