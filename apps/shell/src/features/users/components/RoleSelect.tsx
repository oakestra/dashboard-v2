import { Checkbox, Label } from '@oakestra/ui';
import { useId } from 'react';

import { ROLE_OPTIONS } from '../roles';

interface RoleSelectProps {
  value: readonly string[];
  onChange: (roles: string[]) => void;
  disabled?: boolean;
}

/** Multi-select of the four known roles, each with a short description. */
export function RoleSelect({ value, onChange, disabled }: RoleSelectProps) {
  const prefix = useId();
  const toggle = (role: string, checked: boolean) =>
    onChange(
      // Keep the canonical order so equal selections compare equal in the request body.
      ROLE_OPTIONS.map((option) => option.value).filter((candidate) =>
        candidate === role ? checked : value.includes(candidate),
      ),
    );

  return (
    <div role="group" aria-label="Roles" className="grid gap-3">
      {ROLE_OPTIONS.map((option) => {
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
              <span className="text-muted-foreground text-sm">{option.description}</span>
            </Label>
          </div>
        );
      })}
    </div>
  );
}
