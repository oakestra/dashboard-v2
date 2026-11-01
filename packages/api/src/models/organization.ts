import { z } from 'zod';

import { list } from './common.ts';

export const organizationMemberSchema = z.looseObject({
  user_id: z.string(),
  roles: list(z.string()),
});

export type OrganizationMember = z.infer<typeof organizationMemberSchema>;

export const organizationSchema = z.looseObject({
  _id: z.string(),
  name: z.string(),
  member: list(organizationMemberSchema),
});

export type Organization = z.infer<typeof organizationSchema>;

export interface OrganizationInput {
  name: string;
  member: { user_id: string; roles: string[] }[];
}

/** Name of the organization every user belongs to unless they log in to another one. */
export const ROOT_ORGANIZATION_NAME = 'root';
