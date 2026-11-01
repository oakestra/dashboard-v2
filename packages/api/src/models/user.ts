import { z } from 'zod';

import { list, optionalString } from './common.ts';

/**
 * A dashboard user.
 *
 * Deliberately a strict-by-stripping `z.object` instead of a loose one: `/users/` and `/user/{name}`
 * return the password hash, and stripping unknown keys is what keeps it out of the query cache,
 * the devtools and every component that receives a user.
 */
export const userSchema = z.object({
  _id: z.string(),
  name: z.string(),
  email: optionalString.transform((value) => value ?? ''),
  /** Free-form date string, e.g. `"31/07/2026 22:49"` or `"01/11/2026, 16:34"`. Display as is. */
  created_at: optionalString,
  /**
   * Roles in the organization of the current session. Only present on `/user/{name}` and
   * `/users/{organizationId}`, not on `/users/`.
   */
  roles: z.array(z.string()).optional(),
  organization_id: optionalString,
});

export type User = z.infer<typeof userSchema>;

export const permissionsSchema = z.looseObject({ roles: list(z.string()) });

export interface UserCreateInput {
  name: string;
  email: string;
  password: string;
  roles: string[];
  /** The backend stores whatever string it gets; the old dashboard sent `dd/mm/yyyy hh:mm`. */
  created_at: string;
}

/**
 * Fields for `PUT /user/{name}` (admins only). Never send a whole user object back: the backend
 * `$set`s every field it receives, so a stale or stripped object would overwrite real data.
 */
export interface UserUpdate {
  email?: string;
  /** Replaces the user's roles in the organization of the current session. */
  roles?: string[];
}

export interface PasswordChange {
  oldPassword: string;
  newPassword: string;
}
