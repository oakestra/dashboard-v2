import { createContext, useContext } from 'react';
import { useStore } from 'zustand';

import type { AuthSession, AuthState } from './session';

export const AuthSessionContext = createContext<AuthSession | null>(null);

export function useAuthSession(): AuthSession {
  const session = useContext(AuthSessionContext);
  if (!session)
    throw new Error('useAuthSession() must be used below <AuthSessionContext.Provider>');
  return session;
}

export function useAuthState<T>(selector: (state: AuthState) => T): T {
  return useStore(useAuthSession().store, selector);
}
