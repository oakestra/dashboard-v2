import backend from './fixtures/backend.json' with { type: 'json' };

/** Records in the shape the system-manager stores and returns them (not the parsed models). */
export interface MockUser {
  _id: string;
  name: string;
  email: string;
  created_at: string;
  /** Plain text, mock only. The real backend stores a hash. */
  password: string;
}

export interface MockOrganization {
  _id: string;
  name: string;
  member: { user_id: string; roles: string[] }[];
}

export interface MockApplication {
  _id: string;
  applicationID: string;
  application_name: string;
  application_namespace: string;
  application_desc: string;
  microservices: string[];
  /** Owner username. */
  userId: string;
  [key: string]: unknown;
}

export interface MockInstance {
  instance_number: number;
  status: string;
  [key: string]: unknown;
}

export interface MockService {
  _id: string;
  microserviceID: string;
  microservice_name: string;
  microservice_namespace: string;
  applicationID: string;
  app_name: string;
  app_ns: string;
  instance_list: MockInstance[];
  next_instance_progressive_number: number;
  [key: string]: unknown;
}

export interface MockCluster {
  _id: string;
  cluster_name: string;
  active: boolean;
  [key: string]: unknown;
}

export interface MockResetToken {
  token: string;
  username: string;
  expiresAt: number;
}

export interface MockData {
  users: MockUser[];
  organizations: MockOrganization[];
  applications: MockApplication[];
  services: MockService[];
  clusters: MockCluster[];
  resetTokens: MockResetToken[];
}

/**
 * Every fixture user's password is their username (`Admin`/`Admin`, `alice`/`alice`, ...).
 *
 * Roles in the root organization:
 * - Admin: every role
 * - alice: Application_Provider
 * - bob: Infrastructure_Provider
 * - carol: Organization_Admin, Application_Provider
 * - dave: Application_Provider
 */
export const MOCK_USERS: readonly string[] = backend.users.map((user) => user.name);

function seedData(): MockData {
  const data = structuredClone(backend) as unknown as Omit<MockData, 'users' | 'resetTokens'> & {
    users: Omit<MockUser, 'password'>[];
  };
  return {
    ...data,
    users: data.users.map((user) => ({ ...user, password: user.name })),
    resetTokens: [],
  };
}

export interface MockStore {
  data: MockData;
  /** Restores the seed, e.g. between tests. */
  reset(): void;
}

export function createMockStore(customize?: (data: MockData) => void): MockStore {
  const store: MockStore = {
    data: seedData(),
    reset() {
      store.data = seedData();
      customize?.(store.data);
    },
  };
  customize?.(store.data);
  return store;
}

/** Mongo-style 24 hex character id. */
export function createObjectId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export const ROOT_ORGANIZATION = 'root';
