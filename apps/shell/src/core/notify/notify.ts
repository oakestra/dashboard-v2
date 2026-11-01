import type { Notify } from '@oakestra/dashboard-sdk';
import { toast } from '@oakestra/ui';

export const notify: Notify = {
  success: (message, options) => toast.success(message, options),
  info: (message, options) => toast.info(message, options),
  warning: (message, options) => toast.warning(message, options),
  error: (message, options) => toast.error(message, options),
};

/** A sticky toast with a reload button, for changes that cannot be applied to the running page. */
export function notifyReloadRequired(id: string, message: string, description?: string): void {
  toast.info(message, {
    id,
    description,
    duration: Number.POSITIVE_INFINITY,
    action: { label: 'Reload', onClick: () => window.location.reload() },
  });
}
