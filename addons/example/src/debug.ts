import { useHostContext } from '@oakestra/dashboard-sdk';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

interface SingletonProbe {
  useState: unknown;
  queryClient: unknown;
  useHostContext: unknown;
  user: unknown;
}

declare global {
  interface Window {
    __OAK_DEBUG__?: { addons: Record<string, SingletonProbe> };
  }
}

/**
 * Reports this addon's view of the shared singletons to the shell's e2e debug hook, which only
 * exists in test builds of the shell. Real addons have no reason to do this.
 */
export function useSingletonProbe(): void {
  const queryClient = useQueryClient();
  const host = useHostContext();
  useEffect(() => {
    const debug = window.__OAK_DEBUG__;
    if (!debug) return;
    debug.addons.example = { useState, queryClient, useHostContext, user: host.user };
  }, [queryClient, host.user]);
}
