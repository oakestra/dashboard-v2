import { useId } from 'react';

import { Checkbox } from './checkbox';
import { FieldLegend, FieldSet } from './field';
import { Label } from './label';

export interface CheckboxGroupOption {
  value: string;
  label: string;
  description?: string;
}

export interface CheckboxGroupProps {
  legend: string;
  options: readonly CheckboxGroupOption[];
  value: readonly string[];
  onChange: (value: string[]) => void;
  disabled?: boolean;
}

/** Multi-select as a list of labelled checkboxes with an optional description each. */
export function CheckboxGroup({ legend, options, value, onChange, disabled }: CheckboxGroupProps) {
  const prefix = useId();
  const toggle = (changed: string, checked: boolean) =>
    onChange(
      // Keep the options' order so equal selections compare equal in request bodies.
      options
        .map((option) => option.value)
        .filter((candidate) => (candidate === changed ? checked : value.includes(candidate))),
    );

  return (
    // A fieldset, not a Field: an invalid Field would turn every checkbox label red.
    <FieldSet className="gap-0">
      <FieldLegend variant="label">{legend}</FieldLegend>
      <div className="grid gap-3">
        {options.map((option) => {
          const id = `${prefix}-${option.value}`;
          return (
            <div key={option.value} className="flex items-start gap-3">
              <Checkbox
                id={id}
                className="mt-0.5"
                disabled={disabled}
                checked={value.includes(option.value)}
                onCheckedChange={(checked) => toggle(option.value, checked === true)}
              />
              <Label htmlFor={id} className="grid gap-0.5 font-normal">
                <span className="font-medium">{option.label}</span>
                {option.description ? (
                  <span className="text-muted-foreground text-sm">{option.description}</span>
                ) : null}
              </Label>
            </div>
          );
        })}
      </div>
    </FieldSet>
  );
}
