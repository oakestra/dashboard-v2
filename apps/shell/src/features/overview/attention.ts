import type { Application, Service } from '@oakestra/api';

import { describeStatus, isTransitionalStatus, type StatusTone } from '../services';

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
      const own = describeStatus(service.status, service.status_detail);
      if (own.tone === 'destructive' || own.tone === 'warning') {
        items.push({
          ...base,
          status: service.status,
          detail: service.status_detail,
          tone: own.tone,
          note: own.hint || own.label,
        });
        continue;
      }
      const failing = service.instance_list.filter((instance) => {
        const { tone } = describeStatus(instance.status);
        return tone === 'destructive' || tone === 'warning';
      });
      if (failing.length > 0) {
        const worst = failing[0]!;
        const description = describeStatus(worst.status, worst.status_detail);
        items.push({
          ...base,
          status: worst.status,
          detail: worst.status_detail,
          tone: description.tone,
          note: `${failing.length} of ${service.instance_list.length} ${
            service.instance_list.length === 1 ? 'instance' : 'instances'
          } failing`,
        });
        continue;
      }
      if (service.instance_list.length === 0 && !isTransitionalStatus(service.status)) {
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
