import { isApiError, type RegisterAddonInput } from '@oakestra/api';
import { useNotify } from '@oakestra/dashboard-sdk';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { useAddonsAdminApi } from '../../../core/addons/addons-admin';
import { useRefreshUiAddons } from '../../../core/addons/use-refresh-ui-addons';
import { addonManagerKeys } from '../keys';

export function useInstallAddon() {
  const { manager } = useAddonsAdminApi();
  const queryClient = useQueryClient();
  const notify = useNotify();
  return useMutation({
    mutationFn: (addon: { marketplaceId: string; name: string }) =>
      manager.install(addon.marketplaceId),
    meta: { errorMessage: 'Could not install the addon' },
    onSuccess: async (_installed, addon) => {
      notify.success(`Installing ${addon.name}`);
      // Both lists show the new status ("Installed" badge on the card, a row in the table).
      await queryClient.invalidateQueries({ queryKey: addonManagerKeys.all });
    },
  });
}

/** What `useDisableAddon` found out, so the toast can say what actually happened. */
export type DisableOutcome = 'disabling' | 'already-disabled' | 'removed' | 'gone';

const isNotFound = (error: unknown) => isApiError(error) && error.status === 404;

/**
 * First DELETE: the addon moves to `disabling` and ends `disabled` on its own.
 *
 * The backend deletes the record when it receives a DELETE for an addon that is already
 * `disabled`, so a stale row ("Disable" clicked while the list still says active) could remove
 * an addon the person only wanted to stop. The current status is read first for that reason; the
 * race that remains is the few milliseconds between the read and the DELETE.
 */
export function useDisableAddon() {
  const { manager } = useAddonsAdminApi();
  const queryClient = useQueryClient();
  const refreshUiAddons = useRefreshUiAddons();
  const notify = useNotify();
  return useMutation({
    mutationFn: async (addon: { id: string; name: string }): Promise<DisableOutcome> => {
      try {
        const current = await manager.get(addon.id);
        if (current.status === 'disabled') return 'already-disabled';
      } catch (error) {
        if (isNotFound(error)) return 'gone';
        throw error;
      }
      const result = await manager.remove(addon.id);
      return result.kind;
    },
    meta: { errorMessage: 'Could not disable the addon' },
    onSuccess: async (outcome, addon) => {
      if (outcome === 'disabling') notify.success(`Disabling ${addon.name}`);
      else if (outcome === 'already-disabled') {
        notify.info(`${addon.name} was already disabled`, {
          description: 'The list was out of date. Use Remove to delete it.',
        });
      } else if (outcome === 'removed') {
        notify.info(`${addon.name} had finished disabling and was removed`);
      } else notify.info(`${addon.name} no longer exists`);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: addonManagerKeys.installed() }),
        // Its UI is gone as soon as the containers stop; do not wait for the next poll.
        refreshUiAddons(),
      ]);
    },
  });
}

/** Second DELETE, on a `disabled` addon: the record is deleted. */
export function useRemoveAddon() {
  const { manager } = useAddonsAdminApi();
  const queryClient = useQueryClient();
  const notify = useNotify();
  return useMutation({
    mutationFn: async (addon: { id: string; name: string }) => {
      try {
        return await manager.remove(addon.id);
      } catch (error) {
        // Someone else removed it already, which is what was asked for.
        if (isNotFound(error)) return { kind: 'gone' } as const;
        throw error;
      }
    },
    meta: { errorMessage: 'Could not remove the addon' },
    onSuccess: async (result, addon) => {
      // The addon was not disabled after all (changed since the list was loaded): the backend
      // started disabling it instead of deleting it.
      if (result.kind === 'disabling') notify.info(`${addon.name} is still shutting down`);
      else if (result.kind === 'gone') notify.info(`${addon.name} was already removed`);
      else notify.success(`Removed ${addon.name}`);
      await queryClient.invalidateQueries({ queryKey: addonManagerKeys.installed() });
    },
  });
}

export function useRegisterAddon() {
  const { marketplace } = useAddonsAdminApi();
  const queryClient = useQueryClient();
  const notify = useNotify();
  return useMutation({
    mutationFn: (input: RegisterAddonInput) => marketplace.register(input),
    // The dialog shows the reason next to the input.
    meta: { silent: true },
    onSuccess: async (definition) => {
      notify.success(`Submitted ${definition.name} for review`, {
        description: 'It is listed in the marketplace once the review approved it.',
      });
      await queryClient.invalidateQueries({ queryKey: addonManagerKeys.marketplace() });
    },
  });
}

export function useDeleteDefinition() {
  const { marketplace } = useAddonsAdminApi();
  const queryClient = useQueryClient();
  const notify = useNotify();
  return useMutation({
    mutationFn: (definition: { id: string; name: string }) => marketplace.remove(definition.id),
    meta: { errorMessage: 'Could not delete the addon definition' },
    onSuccess: async (_result, definition) => {
      notify.success(`Deleted ${definition.name} from the marketplace`);
      await queryClient.invalidateQueries({ queryKey: addonManagerKeys.marketplace() });
    },
  });
}
