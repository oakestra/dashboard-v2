import { isApiError } from '@oakestra/api';
import { Button, EmptyState } from '@oakestra/ui';
import { SearchXIcon } from 'lucide-react';
import { Link } from 'react-router';

/**
 * A detail endpoint answering 404: the id in the URL names nothing (deleted, or never existed).
 * The page then says so instead of showing a load error with a retry that cannot succeed.
 */
export function isNotFound(error: unknown): boolean {
  return isApiError(error) && error.status === 404;
}

export function NotFound({
  title,
  description,
  back,
  backLabel,
}: {
  title: string;
  description: string;
  back: string;
  backLabel: string;
}) {
  return (
    <EmptyState
      icon={<SearchXIcon />}
      title={title}
      description={description}
      action={
        <Button asChild variant="outline">
          <Link to={back}>{backLabel}</Link>
        </Button>
      }
    />
  );
}
