import { useAddonPath } from '@oakestra/dashboard-sdk';
import { Button } from '@oakestra/ui';
import { Link, useParams } from 'react-router';

export function DetailsPage() {
  const { itemId } = useParams();
  const addonPath = useAddonPath();
  return (
    <div className="ex:space-y-4">
      <h1 className="ex:text-2xl ex:font-semibold" data-testid="example-details">
        Item {itemId}
      </h1>
      <Button asChild variant="outline">
        <Link to={addonPath()}>Back</Link>
      </Button>
    </div>
  );
}
