import {
  isApiError,
  isConsentRequiredError,
  type AddTapInput,
  type ConsentRequest,
  type InstalledAddon,
  type RegisterAddonInput,
} from '@oakestra/api';
import { useNotify } from '@oakestra/dashboard-sdk';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { useAddonsAdminApi } from '../../../core/addons/addons-admin';
import { addonManagerKeys } from '../keys';

/**
 * Install, update and approve either go through or come back with the definition the admin has
 * to accept first. The first call never carries a hash (the catalog serves none), so that answer
 * is a step of the flow, not a failure: it is a result here and the global mutation error toast
 * never sees it.
 */
export type ConsentOutcome =
  { kind: 'done'; addon: InstalledAddon } | { kind: 'consent'; request: ConsentRequest };

async function withConsent(run: () => Promise<InstalledAddon>): Promise<ConsentOutcome> {
  try {
    return { kind: 'done', addon: await run() };
  } catch (error) {
    if (isConsentRequiredError(error)) return { kind: 'consent', request: error.consentRequest };
    throw error;
  }
}

interface AcceptVariables {
  /** The definition hash the admin accepted in the dialog; absent for the first call. */
  acceptDefinition?: string;
}

export function useInstallAddon() {
  const { manager } = useAddonsAdminApi();
  const queryClient = useQueryClient();
  const notify = useNotify();
  return useMutation({
    mutationFn: ({
      qualifiedName,
      acceptDefinition,
    }: AcceptVariables & { qualifiedName: string }) =>
      withConsent(() => manager.install(qualifiedName, { acceptDefinition })),
    meta: { errorMessage: 'Could not install the addon' },
    onSuccess: async (outcome, { qualifiedName }) => {
      if (outcome.kind !== 'done') return;
      // Not a success: the install has only been accepted. The outcome toast comes from
      // useInstallOutcomeToasts once the status settles.
      notify.info(`Installing ${qualifiedName}`, {
        description: 'You will be notified when it is active or if it fails.',
      });
      // The marketplace itself is unchanged: its "Installed" badges come from the installed list
      // too, like the new row in the table.
      await queryClient.invalidateQueries({ queryKey: addonManagerKeys.installed() });
    },
  });
}

/** Moves an installed addon to the catalog's latest version. */
export function useUpdateAddon() {
  const { manager } = useAddonsAdminApi();
  const queryClient = useQueryClient();
  const notify = useNotify();
  return useMutation({
    mutationFn: ({ id, acceptDefinition }: AcceptVariables & { id: string; name: string }) =>
      withConsent(() => manager.update(id, { acceptDefinition })),
    meta: { errorMessage: 'Could not update the addon' },
    onSuccess: async (outcome, { name }) => {
      if (outcome.kind !== 'done') return;
      notify.info(`Updating ${name} to ${outcome.addon.version}`);
      await queryClient.invalidateQueries({ queryKey: addonManagerKeys.installed() });
    },
  });
}

/** Signs the grant again; a failed addon is deployed again. */
export function useApproveAddon() {
  const { manager } = useAddonsAdminApi();
  const queryClient = useQueryClient();
  const notify = useNotify();
  return useMutation({
    mutationFn: ({ id, acceptDefinition }: AcceptVariables & { id: string; name: string }) =>
      withConsent(() => manager.approve(id, { acceptDefinition })),
    meta: { errorMessage: 'Could not approve the addon' },
    onSuccess: async (outcome, { name }) => {
      if (outcome.kind !== 'done') return;
      notify.success(
        outcome.addon.status === 'installing'
          ? `Approved ${name}, deploying it again`
          : `Approved ${name}`,
      );
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

/** The catalog and the source counts both change with the local source. */
async function invalidateCatalog(queryClient: ReturnType<typeof useQueryClient>) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: addonManagerKeys.marketplace() }),
    queryClient.invalidateQueries({ queryKey: addonManagerKeys.sources() }),
  ]);
}

export function useRegisterAddon() {
  const { marketplace } = useAddonsAdminApi();
  const queryClient = useQueryClient();
  const notify = useNotify();
  return useMutation({
    mutationFn: (input: RegisterAddonInput) => marketplace.register(input),
    // The dialog shows the reason next to the input.
    meta: { silent: true },
    onSuccess: async (item) => {
      notify.success(`Registered ${item.qualified_name} ${item.version}`);
      await invalidateCatalog(queryClient);
    },
  });
}

export function useDeleteLocalAddon() {
  const { marketplace } = useAddonsAdminApi();
  const queryClient = useQueryClient();
  const notify = useNotify();
  return useMutation({
    mutationFn: (item: { name: string; qualifiedName: string }) =>
      marketplace.removeLocal(item.name),
    meta: { errorMessage: 'Could not delete the addon definition' },
    onSuccess: async (_result, item) => {
      notify.success(`Deleted ${item.qualifiedName} from the marketplace`);
      await invalidateCatalog(queryClient);
    },
  });
}

export function useAddTap() {
  const { marketplace } = useAddonsAdminApi();
  const queryClient = useQueryClient();
  const notify = useNotify();
  return useMutation({
    mutationFn: (input: AddTapInput) => marketplace.sources.add(input),
    // The dialog shows the reason next to the input.
    meta: { silent: true },
    onSuccess: async (source) => {
      // A failing first sync does not undo the tap; the list shows its error.
      if (source.last_error) {
        notify.warning(`Added ${source.name}, but its index could not be fetched`, {
          description: source.last_error,
        });
      } else {
        notify.success(`Added ${source.name}`, {
          description: `${source.addon_count} addons synced.`,
        });
      }
      await invalidateCatalog(queryClient);
    },
  });
}

export function useSyncSource() {
  const { marketplace } = useAddonsAdminApi();
  const queryClient = useQueryClient();
  const notify = useNotify();
  return useMutation({
    mutationFn: (name: string) => marketplace.sources.sync(name),
    meta: { errorMessage: 'Could not sync the source' },
    onSuccess: (source) => {
      notify.success(`Synced ${source.name}`, {
        description: `${source.addon_count} addons listed.`,
      });
    },
    // A failed sync is recorded on the source as well, so refetch either way.
    onSettled: () => invalidateCatalog(queryClient),
  });
}

export function useDeleteSource() {
  const { marketplace } = useAddonsAdminApi();
  const queryClient = useQueryClient();
  const notify = useNotify();
  return useMutation({
    mutationFn: (name: string) => marketplace.sources.remove(name),
    meta: { errorMessage: 'Could not delete the source' },
    onSuccess: async (_result, name) => {
      notify.success(`Deleted ${name}`);
      await invalidateCatalog(queryClient);
    },
  });
}
