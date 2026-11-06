import { useAddonPath } from '@oakestra/dashboard-sdk';
import { Button, PageHeader } from '@oakestra/ui';
import { Link, useParams } from 'react-router';

export function DetailsPage() {
  const { itemId } = useParams();
  const addonPath = useAddonPath();
  return (
    <div className="ex:space-y-5">
      <PageHeader
        title={<span data-testid="example-details">Item {itemId}</span>}
        actions={
          <Button asChild variant="outline">
            <Link to={addonPath()}>Back</Link>
          </Button>
        }
      />
    </div>
  );
}
