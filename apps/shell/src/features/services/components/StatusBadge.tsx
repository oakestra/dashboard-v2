import { Badge } from '@oakestra/ui';

import { statusTone, type StatusTone } from '../status';

const VARIANT: Record<StatusTone, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  success: 'default',
  pending: 'secondary',
  danger: 'destructive',
  neutral: 'outline',
};

export function StatusBadge({ status }: { status: string | undefined }) {
  return (
    <Badge variant={VARIANT[statusTone(status)]} data-testid="status-badge">
      {status ?? 'Not deployed'}
    </Badge>
  );
}
