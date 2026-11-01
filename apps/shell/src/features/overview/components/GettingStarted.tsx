import { Button, SectionCard } from '@oakestra/ui';
import { PlusIcon } from 'lucide-react';

const STEPS = [
  ['Create an application', 'A name and a namespace that group your services.'],
  ['Add a service', 'Describe the container image, resources and ports to run.'],
  ['Deploy an instance', 'The scheduler places it on a cluster with enough capacity.'],
] as const;

export function GettingStarted({ onCreate }: { onCreate: () => void }) {
  return (
    <SectionCard
      title="Deploy your first service"
      description="You have no applications yet. Three steps get something running."
      action={
        <Button onClick={onCreate}>
          <PlusIcon aria-hidden /> New application
        </Button>
      }
      data-testid="getting-started"
    >
      <ol className="grid gap-4 sm:grid-cols-3">
        {STEPS.map(([title, description], index) => (
          <li key={title} className="flex gap-3">
            <span
              aria-hidden
              className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary tabular-nums"
            >
              {index + 1}
            </span>
            <span className="min-w-0 space-y-0.5">
              <span className="block text-sm font-medium">{title}</span>
              <span className="block text-sm text-pretty text-muted-foreground">{description}</span>
            </span>
          </li>
        ))}
      </ol>
    </SectionCard>
  );
}
