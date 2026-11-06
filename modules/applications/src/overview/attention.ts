import { plural } from '@oakestra/ui';
import type { Application, Service } from '@oakestra/api';

import { describeStatus, serviceAttention, type StatusTone } from '../services/status';

export interface AttentionItem {
  key: string;
  applicationId: string;
  applicationName: string;
  service: Service;
  /** What the badge shows: the service's or its worst instance's raw status (undefined = not deployed). */
  status: string | undefined;
  detail: string | undefined;
  tone: StatusTone;
  /** Short explanation next to the service name. */
  note: string;
}

const SEVERITY: Partial<Record<StatusTone, number>> = { destructive: 0, warning: 1 };

/**
 * Services that need a person: the scheduler gave up on them, they or one of their instances
 * failed, or nobody deployed them yet. Ordered worst first, undeployed last. A service that is
 * merely being scheduled is not listed, it resolves on its own.
 */
export function attentionItems(
  entries: readonly { application: Application; services: readonly Service[] }[],
): AttentionItem[] {
  const items: AttentionItem[] = [];
  for (const { application, services } of entries) {
    for (const service of services) {
      const base = {
        key: service._id,
        applicationId: application._id,
        applicationName: application.application_name,
        service,
      };
      const attention = serviceAttention(service);
      if (!attention) continue;
      if (attention.kind === 'service') {
        const own = describeStatus(service.status, service.status_detail);
        items.push({
          ...base,
          status: attention.status,
          detail: attention.detail,
          tone: attention.tone,
          note: own.hint || own.label,
        });
      } else if (attention.kind === 'instances') {
        items.push({
          ...base,
          status: attention.status,
          detail: attention.detail,
          tone: attention.tone,
          note: `${attention.failing} of ${plural(service.instance_list.length, 'instance')} failing`,
        });
      } else {
        items.push({
          ...base,
          status: undefined,
          detail: undefined,
          tone: 'neutral',
          note: 'Deploy an instance to start it',
        });
      }
    }
  }
  // Array.sort is stable, so the backend's order is kept within a severity.
  return items.sort((a, b) => (SEVERITY[a.tone] ?? 2) - (SEVERITY[b.tone] ?? 2));
}
