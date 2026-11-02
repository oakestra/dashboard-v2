import type { Organization, OrganizationMember } from '@oakestra/api';
import { useNotify, useOakestraApi } from '@oakestra/dashboard-sdk';
import { useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';

import { userKeys } from '../../users/keys';
import { organizationKeys } from '../keys';

// Members and their organization roles are served by the user endpoints too.
function invalidateOrganizationsAndUsers(queryClient: QueryClient) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: organizationKeys.all }),
    queryClient.invalidateQueries({ queryKey: userKeys.all }),
  ]);
}

export function useCreateOrganization() {
  const api = useOakestraApi();
  const queryClient = useQueryClient();
  const notify = useNotify();
  return useMutation({
    mutationFn: (name: string) => api.organizations.create({ name, member: [] }),
    meta: { silent: true },
    onSuccess: async (_data, name) => {
      notify.success(`Organization ${name} created`);
      await invalidateOrganizationsAndUsers(queryClient);
    },
  });
}

export function useDeleteOrganization() {
  const api = useOakestraApi();
  const queryClient = useQueryClient();
  const notify = useNotify();
  return useMutation({
    mutationFn: (organization: Organization) => api.organizations.delete(organization._id),
    meta: { errorMessage: 'Could not delete the organization' },
    onSuccess: async (_data, organization) => {
      notify.success(`Organization ${organization.name} deleted`);
      await invalidateOrganizationsAndUsers(queryClient);
    },
  });
}

/**
 * Members are not addressable on their own: `PUT /organization/{id}` replaces the whole `member`
 * list. Callers pass the complete new list.
 */
export function useSetOrganizationMembers(organization: Organization) {
  const api = useOakestraApi();
  const queryClient = useQueryClient();
  const notify = useNotify();
  return useMutation({
    mutationFn: (member: OrganizationMember[]) =>
      api.organizations.update(organization._id, { name: organization.name, member }),
    meta: { errorMessage: 'Could not update the members' },
    onSuccess: async () => {
      notify.success(`Members of ${organization.name} updated`);
      await invalidateOrganizationsAndUsers(queryClient);
    },
  });
}

/** Sends the unchanged member list along: the backend `$set`s `member` from the body. */
export function useRenameOrganization(organization: Organization) {
  const api = useOakestraApi();
  const queryClient = useQueryClient();
  const notify = useNotify();
  return useMutation({
    mutationFn: (name: string) =>
      api.organizations.update(organization._id, { name, member: organization.member }),
    meta: { silent: true },
    onSuccess: async (_data, name) => {
      notify.success(`Organization renamed to ${name}`);
      await invalidateOrganizationsAndUsers(queryClient);
    },
  });
}
