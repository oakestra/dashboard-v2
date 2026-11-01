import { Badge, SectionCard } from '@oakestra/ui';

import { ROLE_OPTIONS, roleLabel } from '../../users';

/** Same labels and descriptions as the role picker on the Users page, so the wording never drifts. */
export function RolesCard({ roles }: { roles: readonly string[] }) {
  return (
    <SectionCard title="Roles" description="What you can do in this organization.">
      {roles.length === 0 ? (
        <p className="text-muted-foreground text-sm">You have no roles in this organization.</p>
      ) : (
        <dl
          className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-[max-content_1fr]"
          data-testid="roles"
        >
          {roles.map((role) => (
            <div key={role} className="contents">
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
    </SectionCard>
  );
}
