/**
 * Unsigned stand-ins for the system-manager's JWTs. The dashboard never verifies signatures (the
 * backend does), so these only need the right shape and claims.
 */
export type MockTokenType = 'access' | 'refresh';

export interface MockTokenClaims {
  sub: string;
  roles: readonly string[];
  /** Organization id, like the real `organization` claim. */
  organization: string;
}

export interface DecodedMockToken extends MockTokenClaims {
  type: MockTokenType;
  exp: number;
  iat: number;
}

const SIGNATURE = 'mock-signature';

function encode(value: object): string {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function decode(segment: string): unknown {
  const base64 = segment.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(base64 + '='.repeat((4 - (base64.length % 4)) % 4));
  return JSON.parse(new TextDecoder().decode(Uint8Array.from(binary, (c) => c.charCodeAt(0))));
}

let sequence = 0;

export function createMockToken(
  claims: MockTokenClaims,
  options: { type?: MockTokenType; ttlSeconds: number; now?: number },
): string {
  const iat = Math.floor((options.now ?? Date.now()) / 1000);
  return [
    encode({ alg: 'none', typ: 'JWT' }),
    encode({
      ...claims,
      roles: [...claims.roles],
      user: claims.sub,
      type: options.type ?? 'access',
      iat,
      nbf: iat,
      exp: iat + options.ttlSeconds,
      // Two tokens minted in the same second must still differ, like real ones do (jti).
      jti: `mock-${(sequence += 1)}`,
    }),
    SIGNATURE,
  ].join('.');
}

export type TokenCheck =
  { ok: true; token: DecodedMockToken } | { ok: false; status: 401 | 422; msg: string };

/** Mirrors flask-jwt-extended's answers, including its odd mix of 401 and 422. */
export function verifyMockToken(
  header: string | null,
  expected: MockTokenType,
  now = Date.now(),
): TokenCheck {
  if (!header) return { ok: false, status: 401, msg: 'Missing Authorization Header' };
  const match = /^Bearer (.+)$/.exec(header);
  if (!match)
    return {
      ok: false,
      status: 422,
      msg: "Bad Authorization header. Expected 'Authorization: Bearer <JWT>'",
    };
  const parts = match[1]!.split('.');
  if (parts.length !== 3) return { ok: false, status: 422, msg: 'Not enough segments' };
  if (parts[2] !== SIGNATURE)
    return { ok: false, status: 422, msg: 'Signature verification failed' };

  let token: DecodedMockToken;
  try {
    token = decode(parts[1]!) as DecodedMockToken;
  } catch {
    return { ok: false, status: 422, msg: 'Invalid payload string' };
  }
  if (token.exp * 1000 <= now) return { ok: false, status: 401, msg: 'Token has expired' };
  if (token.type !== expected) {
    return {
      ok: false,
      status: 422,
      msg:
        expected === 'access'
          ? 'Only non-refresh tokens are allowed'
          : 'Only refresh tokens are allowed',
    };
  }
  return { ok: true, token };
}
