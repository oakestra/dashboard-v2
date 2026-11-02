import type { AddonNetwork, AddonService, AddonVolume } from '@oakestra/api';
import { Badge, StatusBadge, cn } from '@oakestra/ui';
import type { ReactNode } from 'react';

interface DefinitionLike {
  /** Services known to be failing (installed addons only), marked on their card. */
  failingServices?: readonly string[];
  services: readonly AddonService[];
  volumes: readonly AddonVolume[];
  networks: readonly AddonNetwork[];
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <h3 className="text-sm font-semibold">{title}</h3>
      {children}
    </section>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[6rem_1fr] gap-2 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </div>
  );
}

function Mono({ children }: { children: ReactNode }) {
  return <code className="bg-muted rounded px-1 py-0.5 font-mono text-xs">{children}</code>;
}

function List({ items }: { items: readonly string[] }) {
  if (items.length === 0) return <span className="text-muted-foreground">none</span>;
  return (
    <span className="flex flex-wrap gap-1">
      {items.map((item) => (
        <Mono key={item}>{item}</Mono>
      ))}
    </span>
  );
}

/**
 * Services, volumes and networks of an addon definition or installed addon. Environment
 * variables are listed by name only: their values may be secrets and are never rendered.
 */
export function DefinitionDetails({
  services,
  volumes,
  networks,
  failingServices = [],
}: DefinitionLike) {
  return (
    <div className="space-y-6">
      <Section title={`Services (${services.length})`}>
        {services.length === 0 ? (
          <p className="text-muted-foreground text-sm">No services.</p>
        ) : (
          <ul className="space-y-3">
            {services.map((service) => {
              const failing = failingServices.includes(service.service_name);
              const ports = Object.entries(service.ports).map(
                ([host, container]) => `${host}:${container}`,
              );
              const environment = Object.keys(service.environment);
              return (
                <li
                  key={service.service_name}
                  className={cn(
                    'space-y-2 rounded-lg border p-3',
                    failing && 'border-l-destructive border-l-4',
                  )}
                  data-testid={`service-${service.service_name}`}
                >
                  <p className="flex flex-wrap items-center gap-2 font-medium">
                    {service.service_name}
                    {failing ? <StatusBadge tone="destructive">Failing</StatusBadge> : null}
                  </p>
                  <dl className="space-y-1.5">
                    <Row label="Image">
                      <Mono>{service.image}</Mono>
                    </Row>
                    {ports.length > 0 ? (
                      <Row label="Ports">
                        <List items={ports} />
                      </Row>
                    ) : null}
                    {service.networks.length > 0 ? (
                      <Row label="Networks">
                        <List items={service.networks} />
                      </Row>
                    ) : null}
                    {service.volumes.length > 0 ? (
                      <Row label="Volumes">
                        <List items={service.volumes} />
                      </Row>
                    ) : null}
                    {environment.length > 0 ? (
                      <Row label="Environment">
                        <span className="space-y-1">
                          <List items={environment} />
                          <span className="text-muted-foreground block text-xs">
                            Variable names only, values are hidden.
                          </span>
                        </span>
                      </Row>
                    ) : null}
                  </dl>
                </li>
              );
            })}
          </ul>
        )}
      </Section>

      {volumes.length > 0 ? (
        <Section title={`Volumes (${volumes.length})`}>
          <ul className="flex flex-wrap gap-2">
            {volumes.map((volume) => (
              <li key={volume.name}>
                <Badge variant="outline">
                  {volume.name}
                  {volume.driver ? (
                    <span className="text-muted-foreground font-normal">{volume.driver}</span>
                  ) : null}
                </Badge>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {networks.length > 0 ? (
        <Section title={`Networks (${networks.length})`}>
          <ul className="flex flex-wrap gap-2">
            {networks.map((network) => (
              <li key={network.name}>
                <Badge variant="outline">
                  {network.name}
                  {network.driver ? (
                    <span className="text-muted-foreground font-normal">{network.driver}</span>
                  ) : null}
                </Badge>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}
    </div>
  );
}
