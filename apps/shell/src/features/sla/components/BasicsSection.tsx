import {
  Checkbox,
  Field,
  FieldError,
  FieldLabel,
  Label,
  RadioGroup,
  RadioGroupItem,
  Textarea,
} from '@oakestra/ui';
import { Controller, useFormContext, useWatch } from 'react-hook-form';

import { ARCHITECTURES, VIRTUALIZATIONS, type ServiceFormValues } from '../model/schema';
import { Section, TextField, useFieldError } from './fields';

const VIRTUALIZATION_LABELS = { container: 'Container', unikernel: 'Unikernel', vm: 'VM' } as const;

export function BasicsSection() {
  const { control, register } = useFormContext<ServiceFormValues>();
  const virtualization = useWatch({ control, name: 'virtualization' });
  const archError = useFieldError('arch');
  return (
    <Section id="basics" title="Basics" description="What the service is and what it runs.">
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField name="name" label="Service name" placeholder="e.g. nginx" autoComplete="off" />
        <TextField name="namespace" label="Namespace" placeholder="default" autoComplete="off" />
      </div>
      <Field>
        <FieldLabel>Virtualization</FieldLabel>
        <Controller
          control={control}
          name="virtualization"
          render={({ field }) => (
            <RadioGroup
              className="flex flex-wrap gap-4"
              aria-label="Virtualization"
              value={field.value}
              onValueChange={field.onChange}
            >
              {VIRTUALIZATIONS.map((value) => (
                <div key={value} className="flex items-center gap-2">
                  <RadioGroupItem value={value} id={`sla-virtualization-${value}`} />
                  <Label htmlFor={`sla-virtualization-${value}`}>
                    {VIRTUALIZATION_LABELS[value]}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          )}
        />
      </Field>
      {virtualization === 'unikernel' ? (
        <Field data-invalid={!!archError}>
          <FieldLabel>Architecture</FieldLabel>
          <Controller
            control={control}
            name="arch"
            render={({ field }) => (
              <div className="flex flex-wrap gap-4" role="group" aria-label="Architecture">
                {ARCHITECTURES.map((arch) => (
                  <div key={arch} className="flex items-center gap-2">
                    <Checkbox
                      id={`sla-arch-${arch}`}
                      checked={field.value.includes(arch)}
                      onCheckedChange={(checked) =>
                        field.onChange(
                          checked
                            ? [...field.value, arch]
                            : field.value.filter((value) => value !== arch),
                        )
                      }
                    />
                    <Label htmlFor={`sla-arch-${arch}`}>{arch}</Label>
                  </div>
                ))}
              </div>
            )}
          />
          <FieldError errors={[archError]} />
        </Field>
      ) : null}
      <TextField
        name="code"
        label="Image or code URL"
        placeholder="docker.io/library/nginx:latest"
        description="A container image, or the URL of the unikernel or VM image."
        autoComplete="off"
      />
      <Field>
        <FieldLabel htmlFor="sla-description">Description</FieldLabel>
        <Textarea id="sla-description" rows={2} {...register('description')} />
      </Field>
    </Section>
  );
}
