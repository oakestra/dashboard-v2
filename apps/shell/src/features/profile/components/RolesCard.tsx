import { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@oakestra/ui';

const ROLE_DESCRIPTIONS: Readonly<Record<string, string>> = {
  Admin: 'Manages users, organizations and the whole platform.',
  Organization_Admin: 'Manages the members of an organization.',
  Application_Provider: 'Deploys applications and services.',
  Infrastructure_Provider: 'Contributes and operates clusters.',
};

export function RolesCard({ roles }: { roles: readonly string[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Roles</CardTitle>
        <CardDescription>What you can do in this organization.</CardDescription>
      </CardHeader>
      <CardContent>
        {roles.length === 0 ? (
          <p className="text-muted-foreground text-sm">You have no roles in this organization.</p>
        ) : (
          <ul className="space-y-3" data-testid="roles">
            {roles.map((role) => (
              <li key={role} className="flex flex-col gap-1">
                <Badge variant="secondary">{role.replaceAll('_', ' ')}</Badge>
                {ROLE_DESCRIPTIONS[role] ? (
                  <span className="text-muted-foreground text-sm">{ROLE_DESCRIPTIONS[role]}</span>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
