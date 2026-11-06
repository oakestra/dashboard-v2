import { useCallback, useLayoutEffect, useRef } from 'react';
import { useSearchParams } from 'react-router';

/**
 * One URL search param as state. Setting it to `fallback` removes it, so default views keep a
 * clean URL. Updates replace the history entry: typing into a filter should not fill the back
 * button with one entry per keystroke. The setter keeps its identity across URL changes, so it can
 * go to memoized children.
 */
export function useSearchParam(
  key: string,
  fallback = '',
): [value: string, setValue: (value: string) => void] {
  const [params, setParams] = useSearchParams();
  // react-router hands out a new setter with every URL change.
  const latestSetParams = useRef(setParams);
  useLayoutEffect(() => {
    latestSetParams.current = setParams;
  });
  const setValue = useCallback(
    (value: string) =>
      latestSetParams.current(
        (previous) => {
          const next = new URLSearchParams(previous);
          if (value === fallback) next.delete(key);
          else next.set(key, value);
          return next;
        },
        { replace: true },
      ),
    [key, fallback],
  );
  return [params.get(key) ?? fallback, setValue];
}
