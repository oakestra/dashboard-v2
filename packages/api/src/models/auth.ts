import { z } from 'zod';

import { list } from './common.ts';

export const loginRequestSchema = z.object({
  username: z.string().trim().min(1, 'Enter your username'),
  password: z.string().min(1, 'Enter your password'),
  /** Omit for the root organization. The backend reads this field, not the spec's `organization`. */
  organization_name: z
    .string()
    .trim()
    .optional()
    .transform((value) => value || undefined),
});

export type LoginRequest = z.input<typeof loginRequestSchema>;

export const tokenPairSchema = z.looseObject({
  /** Access token, valid for 10 minutes on a default deployment. */
  token: z.string().min(1),
  /** Refresh token, valid for 7 days. */
  refresh_token: z.string().min(1),
});

export type TokenPair = z.infer<typeof tokenPairSchema>;

export const refreshResponseSchema = z.looseObject({ token: z.string().min(1) });

export const accessTokenClaimsSchema = z.looseObject({
  /** Username. */
  sub: z.string().min(1),
  roles: list(z.string()),
  /**
   * Id of the organization the session belongs to. Logging in without an organization yields the
   * id of the built-in `root` organization, not the string "root".
   */
  organization: z.string().optional(),
  /** Expiry in epoch seconds. */
  exp: z.number(),
  type: z.string().optional(),
});

export type AccessTokenClaims = z.infer<typeof accessTokenClaimsSchema>;

export class InvalidTokenError extends Error {
  override name = 'InvalidTokenError';
}

function decodeBase64Url(segment: string): string {
  const base64 = segment.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

/**
 * Reads the claims of a JWT without verifying it. That is fine for deciding what to show and when
 * to refresh; the backend verifies the signature on every request.
 */
export function decodeTokenClaims(token: string): AccessTokenClaims {
  const payload = token.split('.')[1];
  if (!payload) throw new InvalidTokenError('Not a JWT');
  let json: unknown;
  try {
    json = JSON.parse(decodeBase64Url(payload));
  } catch (error) {
    throw new InvalidTokenError('Token payload is not valid JSON', { cause: error });
  }
  const result = accessTokenClaimsSchema.safeParse(json);
  if (!result.success)
    throw new InvalidTokenError(`Unexpected token claims: ${result.error.message}`);
  return result.data;
}
