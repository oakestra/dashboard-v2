import { ROLE_OPTIONS, roleLabel } from '@oakestra/dashboard-sdk';
import { Badge } from '@oakestra/ui';

/** Same labels and descriptions as the role picker on the Users page, so the wording never drifts. */
export function RolesCard({ roles }: { roles: readonly string[] }) {
  return (
    <section aria-label="Roles" className="py-3">
      <h2 className="px-4 pb-2 text-sm font-semibold">Roles</h2>
      {roles.length === 0 ? (
        <p className="text-muted-foreground px-4 text-sm">
          You have no roles in this organization.
        </p>
      ) : (
        <dl className="divide-y text-sm" data-testid="roles">
          {roles.map((role) => (
            <div
              key={role}
              className="grid gap-1 px-4 py-2 sm:grid-cols-[12rem_1fr] sm:items-center sm:gap-6"
            >
              <dt>
                <Badge variant="secondary">{roleLabel(role)}</Badge>
              </dt>
              <dd className="text-muted-foreground">
                {ROLE_OPTIONS.find((option) => option.value === role)?.description ?? ''}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
}
