import { cn } from '@oakestra/ui';
import type { FieldErrors } from 'react-hook-form';

import type { ServiceFormValues } from '../model/schema';

export const FORM_SECTIONS = [
  {
    id: 'basics',
    label: 'Basics',
    keys: ['name', 'namespace', 'virtualization', 'arch', 'description', 'code'],
  },
  {
    id: 'resources',
    label: 'Resources',
    keys: [
      'memory',
      'vcpus',
      'vgpus',
      'vtpus',
      'bandwidth_in',
      'bandwidth_out',
      'storage',
      'ports',
    ],
  },
  { id: 'command', label: 'Command and environment', keys: ['cmd', 'args', 'environment'] },
  { id: 'constraints', label: 'Constraints', keys: ['constraints'] },
  { id: 'connectivity', label: 'Connectivity', keys: ['connectivity'] },
  { id: 'addresses', label: 'Addresses', keys: ['addresses'] },
  {
    id: 'advanced',
    label: 'Advanced',
    keys: ['state', 'target_node', 'sla_violation_strategy', 'added_files'],
  },
] as const;

type FormSection = (typeof FORM_SECTIONS)[number];
export type FormSectionId = FormSection['id'];

/** RHF keeps errors nested under the top-level field name, so a section checks its own keys. */
function sectionHasErrors(section: FormSection, errors: FieldErrors<ServiceFormValues>): boolean {
  return section.keys.some((key) => key in errors);
}

export function hasErrorsInSection(
  id: FormSectionId,
  errors: FieldErrors<ServiceFormValues>,
): boolean {
  const section = FORM_SECTIONS.find((candidate) => candidate.id === id);
  return section ? sectionHasErrors(section, errors) : false;
}

/** Number of invalid leaf fields; RHF nests errors by path, with `message` on the leaves. */
export function countErrors(errors: unknown): number {
  if (!errors || typeof errors !== 'object') return 0;
  const record = errors as Record<string, unknown>;
  if (typeof record.message === 'string' && 'type' in record) return 1;
  return Object.entries(record).reduce(
    (sum, [key, value]) => (key === 'ref' ? sum : sum + countErrors(value)),
    0,
  );
}

/** Right-hand outline of the form with a red dot on sections that need attention (xl only). */
export function SectionNav({ errors }: { errors: FieldErrors<ServiceFormValues> }) {
  return (
    <nav aria-label="Form sections" className="sticky top-20 hidden self-start xl:block">
      <ul className="space-y-1 border-l text-sm">
        {FORM_SECTIONS.map((section) => {
          const failing = sectionHasErrors(section, errors);
          return (
            <li key={section.id}>
              <a
                href={`#${section.id}`}
                onClick={(event) => {
                  event.preventDefault();
                  document
                    .getElementById(section.id)
                    ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }}
                className={cn(
                  '-ml-px flex items-center justify-between gap-2 border-l-2 border-transparent py-1 pr-2 pl-3 text-muted-foreground hover:border-border hover:text-foreground',
                  failing && 'text-destructive hover:text-destructive',
                )}
              >
                {section.label}
                {failing ? (
                  <span
                    role="img"
                    aria-label="has errors"
                    className="size-1.5 rounded-full bg-destructive"
                  />
                ) : null}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
