import { ROOT_ORGANIZATION, type MockStore } from './store.ts';
import { createMockToken } from './tokens.ts';

export interface MockSessionOptions {
  /** A fixture user (see MOCK_USERS). Defaults to `Admin`. */
  username?: string;
  /**
   * Overrides the roles in the token. The mock backend, like the real one, checks roles on the
   * token, so this is enough to test role-dependent UI without touching the fixtures.
   */
  roles?: readonly string[];
  organizationName?: string;
  accessTokenTtlSeconds?: number;
  now?: number;
}

export interface MockSession {
  username: string;
  accessToken: string;
  refreshToken: string;
}

/** Tokens for a fixture user, as if they had logged in. Skips the HTTP round trip in tests. */
export function createMockSession(store: MockStore, options: MockSessionOptions = {}): MockSession {
  const username = options.username ?? 'Admin';
  const organizationName = options.organizationName ?? ROOT_ORGANIZATION;
  const user = store.data.users.find((candidate) => candidate.name === username);
  if (!user) throw new Error(`No mock user "${username}"`);
  const organization = store.data.organizations.find((org) => org.name === organizationName);
  if (!organization) throw new Error(`No mock organization "${organizationName}"`);

  const roles =
    options.roles ?? organization.member.find((member) => member.user_id === user._id)?.roles ?? [];
  const claims = { sub: username, roles, organization: organization._id };
  return {
    username,
    accessToken: createMockToken(claims, {
      ttlSeconds: options.accessTokenTtlSeconds ?? 600,
      now: options.now,
    }),
    refreshToken: createMockToken(claims, {
      type: 'refresh',
      ttlSeconds: 7 * 24 * 3600,
      now: options.now,
    }),
  };
}
