import { ROLE_OPTIONS } from '@oakestra/dashboard-sdk';
import { CheckboxGroup } from '@oakestra/ui';

interface RoleSelectProps {
  value: readonly string[];
  onChange: (roles: string[]) => void;
  disabled?: boolean;
}

/** Multi-select of the four known roles, each with a short description. */
export function RoleSelect({ value, onChange, disabled }: RoleSelectProps) {
  return (
    <CheckboxGroup
      legend="Roles"
      options={ROLE_OPTIONS}
      value={value}
      onChange={onChange}
      disabled={disabled}
    />
  );
}
