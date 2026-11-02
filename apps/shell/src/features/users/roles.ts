export interface RoleOption {
  value: string;
  label: string;
  description: string;
}

export const ROLE_OPTIONS: readonly RoleOption[] = [
  {
    value: 'Admin',
    label: 'Admin',
    description: 'Manages users, organizations and the whole platform.',
  },
  {
    value: 'Organization_Admin',
    label: 'Organization Admin',
    description:
      'Administrative role inside one organization. Member management currently requires Admin.',
  },
  {
    value: 'Application_Provider',
    label: 'Application Provider',
    description: 'Creates and deploys applications and services.',
  },
  {
    value: 'Infrastructure_Provider',
    label: 'Infrastructure Provider',
    description: 'Operates clusters and nodes.',
  },
];

export function roleLabel(role: string): string {
  return ROLE_OPTIONS.find((option) => option.value === role)?.label ?? role;
}
