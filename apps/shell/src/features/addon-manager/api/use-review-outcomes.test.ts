import { describe, expect, it, vi } from 'vitest';

import { PendingReviews } from './pending-reviews';
import { reviewOutcome } from './use-review-outcomes';

describe('reviewOutcome', () => {
  it('reports a finished review and waits otherwise', () => {
    expect(reviewOutcome('approved')).toBe('approved');
    expect(reviewOutcome('verification_failed')).toBe('verification_failed');
    expect(reviewOutcome('under_review')).toBeNull();
    expect(reviewOutcome(undefined)).toBeNull();
  });
});

describe('PendingReviews', () => {
  it('removes a review once, so its outcome is announced once', () => {
    const store = new PendingReviews();
    const listener = vi.fn();
    store.subscribe(listener);

    store.add({ _id: 'a', name: 'a-addon' }, 1);
    store.add({ _id: 'a', name: 'a-addon' }, 2);
    expect(store.snapshot()).toEqual([{ id: 'a', name: 'a-addon', since: 1 }]);

    expect(store.remove('a')).toBe(true);
    expect(store.remove('a')).toBe(false);
    expect(store.snapshot()).toEqual([]);
    expect(listener).toHaveBeenCalledTimes(2);
  });
});
