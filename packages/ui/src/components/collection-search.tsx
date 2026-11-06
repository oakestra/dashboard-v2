import { SearchIcon } from 'lucide-react';
import * as React from 'react';

import { Input } from './input';

/**
 * Text of the search box. The box must not be bound straight to a `globalFilter` that lives in
 * the URL: the router applies location changes asynchronously, so a keystroke typed before the
 * previous one came back would be rendered over with the stale value and lost. The box keeps its
 * own text, and the controlled value only replaces it when it changes for a reason other than
 * what was typed here (back navigation, a link with `?q=`).
 */
export function useSearchText(controlled: string, onChange: (value: string) => void) {
  const [text, setText] = React.useState(controlled);
  // Values sent up that the controlled value has not echoed yet, oldest first.
  const pending = React.useRef<string[]>([]);

  React.useEffect(() => {
    const echoed = pending.current.indexOf(controlled);
    if (echoed >= 0) {
      pending.current = pending.current.slice(echoed + 1);
      return;
    }
    pending.current = [];
    setText(controlled);
  }, [controlled]);

  const update = (value: string) => {
    pending.current.push(value);
    setText(value);
    onChange(value);
  };
  return [text, update] as const;
}

/** The search box of a `DataTable` or `DataList`. */
export function CollectionSearch({
  label,
  placeholder,
  value,
  onChange,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="relative w-full sm:max-w-xs">
      <SearchIcon
        aria-hidden
        className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
      />
      <Input
        type="search"
        aria-label={`Search ${label}`}
        placeholder={placeholder}
        className="pl-9"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}
