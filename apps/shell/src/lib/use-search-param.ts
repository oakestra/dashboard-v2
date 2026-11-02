import { useCallback } from 'react';
import { useSearchParams } from 'react-router';

/**
 * One URL search param as state. Setting it to `fallback` removes it, so default views keep a
 * clean URL. Updates replace the history entry: typing into a filter should not fill the back
 * button with one entry per keystroke.
 */
export function useSearchParam(
  key: string,
  fallback = '',
): [value: string, setValue: (value: string) => void] {
  const [params, setParams] = useSearchParams();
  const setValue = useCallback(
    (value: string) =>
      setParams(
        (previous) => {
          const next = new URLSearchParams(previous);
          if (value === fallback) next.delete(key);
          else next.set(key, value);
          return next;
        },
        { replace: true },
      ),
    [key, fallback, setParams],
  );
  return [params.get(key) ?? fallback, setValue];
}
