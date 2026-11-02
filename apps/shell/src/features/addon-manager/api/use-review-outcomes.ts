import { isApiError, type MarketplaceAddonStatus } from '@oakestra/api';
import { toast } from '@oakestra/ui';
import { useQueries, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useNavigate } from 'react-router';

import { useAddonsAdminApi } from '../../../core/addons/addons-admin';
import { addonManagerKeys } from '../keys';
import { MARKETPLACE_PATH } from '../paths';
import { pendingReviewsFor, usePendingReviews } from './pending-reviews';
import { definitionReviewQuery } from './queries';

export type ReviewOutcome = 'approved' | 'verification_failed';

/** Null while the review is still running (a missing status included: nothing to report yet). */
export function reviewOutcome(status: MarketplaceAddonStatus | undefined): ReviewOutcome | null {
  return status === 'approved' || status === 'verification_failed' ? status : null;
}

/**
 * Polls the definitions this page registered until their review is done, then refetches the
 * marketplace and toasts the result. The list only has approved definitions, so it can't tell a
 * review that is still running from one that failed.
 */
export function useReviewOutcomes(): void {
  const api = useAddonsAdminApi();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const pending = usePendingReviews(api);
  const results = useQueries({
    queries: pending.map((review) => definitionReviewQuery(api, review)),
  });

  useEffect(() => {
    const store = pendingReviewsFor(api);
    pending.forEach((review, index) => {
      const { data, error } = results[index] ?? {};
      // Deleted while under review (by this page or someone else): there is nothing to announce.
      if (isApiError(error) && error.status === 404) {
        store.remove(review.id);
        return;
      }
      const outcome = reviewOutcome(data?.status);
      if (!outcome || !store.remove(review.id)) return;

      if (outcome === 'approved') {
        void queryClient.invalidateQueries({ queryKey: addonManagerKeys.marketplace() });
        toast.success(`${review.name} is now in the marketplace`, {
          action: { label: 'Open marketplace', onClick: () => void navigate(MARKETPLACE_PATH) },
        });
      } else {
        toast.error(`${review.name} did not pass the review`, {
          description: 'Check that every image exists and can be pulled, then register it again.',
        });
      }
    });
  }, [api, pending, results, queryClient, navigate]);
}
