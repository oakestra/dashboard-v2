import type { User } from '@oakestra/api';
import { ROOT_ORGANIZATION_NAME } from '@oakestra/api';
import type { CurrentUser } from '@oakestra/dashboard-sdk';
import { Card, CardContent, CardHeader, CardTitle } from '@oakestra/ui';

export function AccountCard({ profile, user }: { profile: User; user: CurrentUser }) {
  const rows = [
    { label: 'Username', value: profile.name },
    { label: 'Email', value: profile.email || 'Not set' },
    { label: 'Organization', value: user.organizationName ?? ROOT_ORGANIZATION_NAME },
    { label: 'Member since', value: profile.created_at ?? 'Unknown' },
  ];
  return (
    <Card>
      <CardHeader>
        <CardTitle>Account</CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="grid grid-cols-[max-content_1fr] gap-x-6 gap-y-2 text-sm">
          {rows.map((row) => (
            <div key={row.label} className="contents">
              <dt className="text-muted-foreground">{row.label}</dt>
              <dd data-testid={`account-${row.label.toLowerCase().replaceAll(' ', '-')}`}>
                {row.value}
              </dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  );
}
