import { Button } from '@oakestra/ui';
import { Link } from 'react-router';

export function NotFoundPage() {
  return (
    <div className="space-y-4" data-testid="not-found">
      <h1 className="text-2xl font-semibold">Page not found</h1>
      <p className="text-muted-foreground">The page you are looking for does not exist.</p>
      <Button asChild variant="outline">
        <Link to="/">Back to home</Link>
      </Button>
    </div>
  );
}
