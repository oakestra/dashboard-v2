import { Button, Field, FieldError, FieldLabel, Input } from '@oakestra/ui';
import { Plus, Trash2 } from 'lucide-react';
import { useFieldArray, useFormContext } from 'react-hook-form';

import type { ServiceFormValues } from '../model/schema';
import { FIELD_GAP, Section, SecretInput, StringListField, useFieldError } from './fields';

function EnvironmentRow({ index, onRemove }: { index: number; onRemove: () => void }) {
  const { register } = useFormContext<ServiceFormValues>();
  const error = useFieldError(`environment.${index}.key`);
  const n = index + 1;
  return (
    <div className="space-y-1">
      <div className="flex gap-2">
        <Input
          className="flex-1"
          placeholder="NAME"
          aria-label={`Variable name ${n}`}
          aria-invalid={!!error}
          {...register(`environment.${index}.key`)}
        />
        {/* Duplicate pre-fills real values, which may be secrets. */}
        <div className="flex-[2]">
          <SecretInput
            placeholder="value"
            label={`Variable value ${n}`}
            {...register(`environment.${index}.value`)}
          />
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={`Remove variable ${n}`}
          onClick={onRemove}
        >
          <Trash2 />
        </Button>
      </div>
      <FieldError errors={[error]} />
    </div>
  );
}

export function CommandSection() {
  const { control } = useFormContext<ServiceFormValues>();
  const { fields, append, remove } = useFieldArray({ control, name: 'environment' });
  return (
    <Section
      id="command"
      title="Command and environment"
      description="Overrides for the image's entrypoint and its environment."
    >
      <StringListField
        name="cmd"
        label="Command"
        itemLabel="Command part"
        placeholder="/bin/sh"
        addLabel="Add command part"
      />
      <StringListField name="args" label="Arguments" itemLabel="Argument" addLabel="Add argument" />
      <Field className={FIELD_GAP}>
        <FieldLabel>Environment variables</FieldLabel>
        <div className="space-y-2">
          {fields.map((item, index) => (
            <EnvironmentRow key={item.id} index={index} onRemove={() => remove(index)} />
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => append({ key: '', value: '' })}
          >
            <Plus /> Add variable
          </Button>
        </div>
      </Field>
    </Section>
  );
}
