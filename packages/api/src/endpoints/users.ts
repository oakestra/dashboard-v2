import type { OakestraClient } from '../client.ts';
import { lenientArray } from '../models/common.ts';
import {
  permissionsSchema,
  userSchema,
  type PasswordChange,
  type User,
  type UserCreateInput,
  type UserUpdate,
} from '../models/user.ts';
import { body, parse, send, type RequestOptions } from './request.ts';

// The users collection also holds password reset tokens, which `/users/` returns as well. They
// have no `name` and are dropped here.
const userList = lenientArray(userSchema, 'users');

export interface UserEndpoints {
  /** All users. Admin only. Entries carry no roles. */
  list(options?: RequestOptions): Promise<User[]>;
  /** Members of an organization, with their roles in it. Admin only. */
  listByOrganization(organizationId: string, options?: RequestOptions): Promise<User[]>;
  /** Only works for the logged-in user's own name; anything else is answered with 403. */
  get(username: string, options?: RequestOptions): Promise<User>;
  /** Admin only. The user is added to the organization of the current session. */
  create(user: UserCreateInput): Promise<User>;
  /** Admin only, also for one's own account. */
  update(username: string, update: UserUpdate): Promise<void>;
  /** Admin only. */
  delete(username: string): Promise<void>;
  /** Only for the logged-in user's own account. Fails with 400 if the old password is wrong. */
  changePassword(username: string, change: PasswordChange): Promise<void>;
  /** Roles of the logged-in user in the session's organization. */
  getRoles(username: string, options?: RequestOptions): Promise<string[]>;
}

export function createUserEndpoints(client: OakestraClient): UserEndpoints {
  return {
    async list(options) {
      const call = { method: 'GET', path: '/users/' };
      const data = await send(call, () => client.GET('/users/', { ...options }));
      return parse(userList, data, call);
    },
    async listByOrganization(organizationId, options) {
      const call = { method: 'GET', path: `/users/${organizationId}` };
      const data = await send(call, () =>
        client.GET('/users/{organization_id}', {
          params: { path: { organization_id: organizationId } },
          ...options,
        }),
      );
      return parse(userList, data, call);
    },
    async get(username, options) {
      const call = { method: 'GET', path: `/user/${username}` };
      const data = await send(call, () =>
        client.GET('/user/{username}', { params: { path: { username } }, ...options }),
      );
      return parse(userSchema, data, call);
    },
    async create(user) {
      const call = { method: 'POST', path: '/auth/register' };
      const data = await send(call, () => client.POST('/auth/register', { body: body(user) }));
      return parse(userSchema, data, call);
    },
    async update(username, update) {
      await send({ method: 'PUT', path: `/user/${username}` }, () =>
        client.PUT('/user/{username}', { params: { path: { username } }, body: body(update) }),
      );
    },
    async delete(username) {
      await send({ method: 'DELETE', path: `/user/${username}` }, () =>
        client.DELETE('/user/{username}', { params: { path: { username } } }),
      );
    },
    async changePassword(username, change) {
      await send({ method: 'POST', path: `/user/${username}` }, () =>
        client.POST('/user/{username}', { params: { path: { username } }, body: body(change) }),
      );
    },
    async getRoles(username, options) {
      const call = { method: 'GET', path: `/permission/${username}` };
      const data = await send(call, () =>
        client.GET('/permission/{username}', { params: { path: { username } }, ...options }),
      );
      return parse(permissionsSchema, data, call).roles;
    },
  };
}
