import { Button, Field, FieldError, FieldLabel, Input } from '@oakestra/ui';
import { Plus, Trash2 } from 'lucide-react';
import { useFieldArray, useFormContext } from 'react-hook-form';

import type { ServiceFormValues } from '../model/schema';
import { FIELD_GAP, FormSelect, Section, TextField, useFieldError } from './fields';

const PROTOCOLS = [
  { value: 'tcp', label: 'tcp' },
  { value: 'udp', label: 'udp' },
];

function PortRow({ index, onRemove }: { index: number; onRemove: () => void }) {
  const { register } = useFormContext<ServiceFormValues>();
  const hostError = useFieldError(`ports.${index}.host`);
  const containerError = useFieldError(`ports.${index}.container`);
  const n = index + 1;
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <Input
          inputMode="numeric"
          className="w-28"
          aria-label={`Host port ${n}`}
          aria-invalid={!!hostError}
          {...register(`ports.${index}.host`)}
        />
        <span aria-hidden>:</span>
        <Input
          inputMode="numeric"
          className="w-28"
          aria-label={`Container port ${n}`}
          aria-invalid={!!containerError}
          {...register(`ports.${index}.container`)}
        />
        <FormSelect
          name={`ports.${index}.protocol`}
          aria-label={`Protocol ${n}`}
          className="w-24"
          options={PROTOCOLS}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={`Remove port mapping ${n}`}
          onClick={onRemove}
        >
          <Trash2 />
        </Button>
      </div>
      <FieldError errors={[hostError, containerError]} />
    </div>
  );
}

export function ResourcesSection() {
  const { control } = useFormContext<ServiceFormValues>();
  const { fields, append, remove } = useFieldArray({ control, name: 'ports' });
  return (
    <Section id="resources" title="Resources" description="What each instance needs from a node.">
      <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2 lg:grid-cols-4">
        <TextField name="memory" label="Memory (MB)" inputMode="numeric" />
        <TextField name="vcpus" label="vCPUs" inputMode="numeric" />
        <TextField name="storage" label="Storage (MB)" inputMode="numeric" />
        <TextField name="vgpus" label="vGPUs" inputMode="numeric" />
        <TextField name="vtpus" label="vTPUs" inputMode="numeric" />
        <TextField name="bandwidth_in" label="Bandwidth in (kbit/s)" inputMode="numeric" />
        <TextField name="bandwidth_out" label="Bandwidth out (kbit/s)" inputMode="numeric" />
      </div>
      <Field className={FIELD_GAP}>
        <FieldLabel>Port mappings (host : container)</FieldLabel>
        <div className="space-y-2">
          {fields.map((item, index) => (
            <PortRow key={item.id} index={index} onRemove={() => remove(index)} />
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => append({ host: '', container: '', protocol: 'tcp' })}
          >
            <Plus /> Add port mapping
          </Button>
        </div>
      </Field>
    </Section>
  );
}
