export interface WaitForElementOptions {
  /** Gives up and resolves `null` after this long. */
  timeoutMs: number;
  /** Aborting resolves `null` at once. */
  signal?: AbortSignal;
  root?: ParentNode & Node;
}

/**
 * Resolves with the first element matching `selector`, as soon as it is in the DOM. Pages load
 * their data after navigation and addon widgets arrive even later, so a tour step cannot expect
 * its target to exist yet. Never rejects: a target that does not show up is `null`, and the tour
 * skips that step instead of hanging.
 */
export function waitForElement(
  selector: string,
  { timeoutMs, signal, root = document }: WaitForElementOptions,
): Promise<Element | null> {
  const found = root.querySelector(selector);
  if (found || signal?.aborted) return Promise.resolve(found);

  return new Promise((resolve) => {
    const finish = (element: Element | null) => {
      observer.disconnect();
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
      resolve(element);
    };
    const onAbort = () => finish(null);
    const observer = new MutationObserver(() => {
      const element = root.querySelector(selector);
      if (element) finish(element);
    });
    observer.observe(root, { childList: true, subtree: true, attributes: true });
    const timer = setTimeout(() => finish(null), timeoutMs);
    signal?.addEventListener('abort', onAbort);
  });
}
