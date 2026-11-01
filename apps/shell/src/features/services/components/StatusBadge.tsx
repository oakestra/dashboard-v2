import { StatusBadge as BaseStatusBadge } from '@oakestra/ui';

import { describeStatus } from '../status';

/** Raw backend value stays in `title` and `data-status` for debugging and tests. */
export function StatusBadge({
  status,
  detail,
}: {
  status: string | undefined;
  detail?: string | undefined;
}) {
  const { tone, label, hint, pulse } = describeStatus(status, detail);
  return (
    <BaseStatusBadge
      tone={tone}
      pulse={pulse}
      data-testid="status-badge"
      data-status={status ?? ''}
      title={hint ? `${status ?? label}: ${hint}` : (status ?? label)}
    >
      {label}
    </BaseStatusBadge>
  );
}
