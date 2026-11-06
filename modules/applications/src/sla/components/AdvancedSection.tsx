import { Field, FieldDescription, Label, Switch } from '@oakestra/ui';
import { Controller, useFormContext } from 'react-hook-form';

import type { ServiceFormValues } from '../model/schema';
import { Section, StringListField, TextField } from './fields';

export function AdvancedSection() {
  const { control, getValues } = useFormContext<ServiceFormValues>();
  const v = getValues();
  const hasValues =
    v.one_shot ||
    v.privileged ||
    v.state !== '' ||
    v.sla_violation_strategy !== '' ||
    v.target_node !== '' ||
    v.added_files.length > 0;
  return (
    <Section
      id="advanced"
      title="Advanced"
      description="Rarely needed options."
      collapsible
      defaultOpen={hasValues}
      summary={hasValues ? 'Customized' : 'Defaults'}
    >
      <div className="flex flex-wrap gap-8">
        {(
          [
            ['one_shot', 'Run once', 'Do not restart the service when it terminates.'],
            ['privileged', 'Privileged', 'Grant additional containerd privileges.'],
          ] as const
        ).map(([name, label, description]) => (
          <Controller
            key={name}
            control={control}
            name={name}
            render={({ field }) => (
              <Field orientation="horizontal" className="w-auto items-start">
                <Switch id={`sla-${name}`} checked={field.value} onCheckedChange={field.onChange} />
                <div className="space-y-1">
                  <Label htmlFor={`sla-${name}`}>{label}</Label>
                  <FieldDescription>{description}</FieldDescription>
                </div>
              </Field>
            )}
          />
        ))}
      </div>
      <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2">
        <TextField name="state" label="State URL" description="File with the initial state." />
        <TextField name="target_node" label="Target node" />
        <TextField name="sla_violation_strategy" label="SLA violation strategy" />
      </div>
      <StringListField
        name="added_files"
        label="Added files"
        itemLabel="File URL"
        addLabel="Add file"
      />
    </Section>
  );
}
