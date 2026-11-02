import { ROOT_ORGANIZATION_NAME } from '@oakestra/api';
import { useCurrentUser } from '@oakestra/dashboard-sdk';
import { Badge, Tooltip, TooltipContent, TooltipTrigger } from '@oakestra/ui';
import { Building2Icon } from 'lucide-react';

/** Only shown inside a named organization; the root organization is the unremarkable default. */
export function OrganizationBadge() {
  const user = useCurrentUser();
  const name = user?.organizationName;
  if (!name || name === ROOT_ORGANIZATION_NAME) return null;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge variant="secondary" data-testid="organization-badge" className="gap-1">
          <Building2Icon className="size-3" aria-hidden />
          {name}
        </Badge>
      </TooltipTrigger>
      <TooltipContent>You are working in the organization {name}</TooltipContent>
    </Tooltip>
  );
}
