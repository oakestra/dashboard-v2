import { useAddonBasePath } from '@oakestra/dashboard-sdk';
import { Button } from '@oakestra/ui';
import { Link, useParams } from 'react-router';

export function DetailsPage() {
  const { itemId } = useParams();
  const basePath = useAddonBasePath();
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold" data-testid="example-details">
        Item {itemId}
      </h1>
      <Button asChild variant="outline">
        <Link to={basePath}>Back</Link>
      </Button>
    </div>
  );
}
