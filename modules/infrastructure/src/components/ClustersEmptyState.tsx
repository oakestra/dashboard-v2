import { Button, EmptyState } from '@oakestra/ui';
import { ServerOffIcon } from 'lucide-react';

export function ClustersEmptyState() {
  return (
    <EmptyState
      icon={<ServerOffIcon />}
      title="No clusters yet"
      description="Clusters register themselves with the root orchestrator through the cluster orchestrator. Once one has paired, it shows up here."
      action={
        <Button variant="outline" asChild>
          <a href="https://www.oakestra.io/docs/" target="_blank" rel="noreferrer">
            Read the Oakestra docs
          </a>
        </Button>
      }
    />
  );
}
