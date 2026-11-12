import type { ConsentRequest } from '@oakestra/api';
import { useCallback, useState } from 'react';

import type { ConsentOutcome } from '../api/mutations';
import type { ConsentReview } from './ConsentDialog';

type ConsentCopy = Pick<ConsentReview, 'title' | 'description' | 'confirmLabel'>;

/**
 * State of the `ConsentDialog` for one page: `target` is what the confirmed hash is sent for.
 * Feed it every outcome of an install, update or approve call; it opens the dialog on a consent
 * answer and closes it once the call went through.
 */
export function useConsentReview<T>() {
  const [review, setReview] = useState<(ConsentReview & { target: T }) | null>(null);

  const show = useCallback(
    (target: T, outcome: ConsentOutcome, copy: (request: ConsentRequest) => ConsentCopy) => {
      if (outcome.kind === 'done') {
        setReview(null);
        return;
      }
      const { request } = outcome;
      setReview((previous) => ({
        ...copy(request),
        target,
        request,
        // Another 409 while the dialog was open: the catalog changed under the admin's eyes.
        changed: previous !== null && previous.request.definitionHash !== request.definitionHash,
      }));
    },
    [],
  );
  const clear = useCallback(() => setReview(null), []);

  return { review, show, clear };
}
