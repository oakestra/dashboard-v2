import { Button } from '@oakestra/ui';
import { ArrowLeftIcon, CompassIcon } from 'lucide-react';
import { Link, useNavigate } from 'react-router';

import { ErrorState } from './ErrorState';

export function NotFoundPage() {
  const navigate = useNavigate();
  return (
    <ErrorState
      data-testid="not-found"
      icon={<CompassIcon />}
      code={404}
      title="Page not found"
      actions={
        <>
          <Button variant="outline" onClick={() => void navigate(-1)}>
            <ArrowLeftIcon aria-hidden />
            Go back
          </Button>
          <Button asChild>
            <Link to="/">Back to home</Link>
          </Button>
        </>
      }
    >
      <p>The page you are looking for does not exist. Check the address or use the navigation.</p>
    </ErrorState>
  );
}
