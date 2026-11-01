import { Badge } from '@oakestra/ui';

export function ClusterStatusBadge({ active }: { active: boolean }) {
  return active ? <Badge>Active</Badge> : <Badge variant="outline">Inactive</Badge>;
}
