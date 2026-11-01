import { Button, Field, FieldLabel } from '@oakestra/ui';
import { Plus, Trash2 } from 'lucide-react';
import { useFieldArray, useFormContext } from 'react-hook-form';

import type { ServiceFormValues } from '../model/schema';
import { Section, TextField } from './fields';

export function AddressesSection({ hasError }: { hasError: boolean }) {
  const { control, getValues } = useFormContext<ServiceFormValues>();
  const { fields, append, remove } = useFieldArray({ control, name: 'addresses.instances' });
  const hasValues = Object.values(getValues('addresses')).some((value) =>
    Array.isArray(value) ? value.length > 0 : value !== '',
  );
  return (
    <Section
      id="addresses"
      title="Addresses"
      description="Optional fixed service IPs. Leave empty to let Oakestra allocate them."
      collapsible
      defaultOpen={hasValues}
      summary={hasValues ? 'Set' : 'Allocated by Oakestra'}
      hasError={hasError}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField name="addresses.rr_ip" label="Round-robin IP (IPv4)" placeholder="10.30.0.1" />
        <TextField name="addresses.rr_ip_v6" label="Round-robin IP (IPv6)" />
        <TextField name="addresses.closest_ip" label="Closest IP (IPv4)" placeholder="10.30.1.1" />
        <TextField name="addresses.closest_ip_v6" label="Closest IP (IPv6)" />
      </div>
      <Field>
        <FieldLabel>Per-instance addresses</FieldLabel>
        <div className="space-y-3">
          {fields.map((item, index) => (
            <div key={item.id} className="flex flex-wrap items-start gap-2">
              <TextField
                name={`addresses.instances.${index}.from`}
                label="From"
                className="min-w-40 flex-1"
              />
              <TextField
                name={`addresses.instances.${index}.to`}
                label="To"
                className="min-w-40 flex-1"
              />
              <TextField
                name={`addresses.instances.${index}.start`}
                label="Start"
                className="min-w-40 flex-1"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="mt-6"
                aria-label={`Remove instance address ${index + 1}`}
                onClick={() => remove(index)}
              >
                <Trash2 />
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => append({ from: '', to: '', start: '' })}
          >
            <Plus /> Add instance address
          </Button>
        </div>
      </Field>
    </Section>
  );
}
