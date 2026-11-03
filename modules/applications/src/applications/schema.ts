import { slaApplicationSchema } from '@oakestra/api';
import type { z } from 'zod';

// Reuses the SLA constraints (1 to 32 letters or digits for name and namespace), the same ones the
// backend enforces when it validates the SLA.
export const applicationFormSchema = slaApplicationSchema.pick({
  application_name: true,
  application_namespace: true,
  application_desc: true,
});

export type ApplicationFormInput = z.input<typeof applicationFormSchema>;
export type ApplicationFormValues = z.output<typeof applicationFormSchema>;
