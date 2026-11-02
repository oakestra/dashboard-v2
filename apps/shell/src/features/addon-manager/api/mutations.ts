import { isApiError, type RegisterAddonInput } from '@oakestra/api';
import { useNotify } from '@oakestra/dashboard-sdk';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { useAddonsAdminApi } from '../../../core/addons/addons-admin';
import { addonManagerKeys } from '../keys';
import { pendingReviewsFor } from './pending-reviews';

export function useInstallAddon() {
  const { manager } = useAddonsAdminApi();
  const queryClient = useQueryClient();
  const notify = useNotify();
  return useMutation({
    mutationFn: (addon: { marketplaceId: string; name: string }) =>
      manager.install(addon.marketplaceId),
    meta: { errorMessage: 'Could not install the addon' },
    onSuccess: async (_installed, addon) => {
      // Not a success: the install has only been accepted. The outcome toast comes from
      // useInstallOutcomeToasts once the status settles.
      notify.info(`Installing ${addon.name}`, {
        description: 'You will be notified when it is active or if it fails.',
      });
      // The marketplace itself is unchanged: its "Installed" badges come from the installed list
      // too, like the new row in the table.
      await queryClient.invalidateQueries({ queryKey: addonManagerKeys.installed() });
    },
  });
}

/** What `useDisableAddon` found out, so the toast can say what actually happened. */
export type DisableOutcome = 'disabling' | 'already-disabled' | 'removed' | 'gone';

const isNotFound = (error: unknown) => isApiError(error) && error.status === 404;

/**
 * First DELETE: the addon moves to `disabling` and ends `disabled` on its own.
 *
 * `/ui-addons` is not refetched here: useUiAddonsSync in the layout does that as soon as the
 * refetched list shows the addon is no longer `active`.
 *
 * The backend deletes the record when it receives a DELETE for an addon that is already
 * `disabled`, so a stale row ("Disable" clicked while the list still says active) could remove
 * an addon the person only wanted to stop. The current status is read first for that reason; the
 * race that remains is the few milliseconds between the read and the DELETE.
 */
export function useDisableAddon() {
  const { manager } = useAddonsAdminApi();
  const queryClient = useQueryClient();
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
      await queryClient.invalidateQueries({ queryKey: addonManagerKeys.installed() });
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
  const api = useAddonsAdminApi();
  const queryClient = useQueryClient();
  const notify = useNotify();
  return useMutation({
    mutationFn: (input: RegisterAddonInput) => api.marketplace.register(input),
    // The dialog shows the reason next to the input.
    meta: { silent: true },
    onSuccess: async (definition) => {
      if (definition.status === 'under_review') {
        // useReviewOutcomes (in the layout) polls it and announces the result.
        pendingReviewsFor(api).add(definition);
        notify.success(`Submitted ${definition.name} for review`, {
          description: 'You will be notified when it is listed in the marketplace.',
        });
      } else notify.success(`Registered ${definition.name}`);
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
