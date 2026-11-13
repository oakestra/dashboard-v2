/**
 * Poll intervals of the installed list, in a module of their own so tests can shorten them.
 *
 * Fast while an addon is transitional: the person who just clicked is watching the badge. Slow
 * otherwise, because the reconcile loop changes statuses on its own: a container that crashes
 * after it started is only noticed on a later loop, so an addon that is `active` now can turn
 * `failed` or `partially_active` a minute later.
 */
export const INSTALLED_POLL_MS = 2500;
export const INSTALLED_IDLE_POLL_MS = 10_000;

/**
 * An addon that stayed `installing`, `updating` or `disabling` this long on this page is probably
 * stuck (measured from when the page first saw the status, so a clock skew between browser and
 * backend cannot matter). Fast polling stops and an install can be disabled anyway.
 */
export const STUCK_AFTER_MS = 120_000;
