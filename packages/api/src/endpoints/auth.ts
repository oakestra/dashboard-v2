import {
  loginRequestSchema,
  refreshResponseSchema,
  tokenPairSchema,
  type LoginRequest,
  type TokenPair,
} from '../models/auth.ts';
import type { OakestraClient } from '../client.ts';
import { body, parse, send } from './request.ts';

export interface PasswordResetRequest {
  username: string;
  /**
   * Host the reset link in the email points to. The backend builds
   * `http://<domain>/resetPassword/<token>` from it.
   */
  domain: string;
}

export interface AuthEndpoints {
  login(credentials: LoginRequest): Promise<TokenPair>;
  /** Exchanges a refresh token for a new access token. */
  refresh(refreshToken: string): Promise<string>;
  requestPasswordReset(request: PasswordResetRequest): Promise<void>;
  /** Completes a reset with the token from the email link. */
  resetPassword(request: { token: string; password: string }): Promise<void>;
}

export function createAuthEndpoints(client: OakestraClient): AuthEndpoints {
  return {
    async login(credentials) {
      const call = { method: 'POST', path: '/auth/login' };
      const data = await send(call, () =>
        client.POST('/auth/login', { body: body(loginRequestSchema.parse(credentials)) }),
      );
      return parse(tokenPairSchema, data, call);
    },
    async refresh(refreshToken) {
      const call = { method: 'POST', path: '/auth/refresh' };
      // An explicit Authorization header tells the auth middleware to keep its hands off.
      const data = await send(call, () =>
        client.POST('/auth/refresh', { headers: { Authorization: `Bearer ${refreshToken}` } }),
      );
      return parse(refreshResponseSchema, data, call).token;
    },
    async requestPasswordReset(request) {
      await send({ method: 'POST', path: '/user/' }, () =>
        client.POST('/user/', { body: body(request) }),
      );
    },
    async resetPassword(request) {
      await send({ method: 'PUT', path: '/user/' }, () =>
        client.PUT('/user/', { body: body(request) }),
      );
    },
  };
}
