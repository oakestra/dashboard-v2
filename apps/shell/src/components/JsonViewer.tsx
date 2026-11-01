import { Button, Collapsible, CollapsibleContent, CollapsibleTrigger, cn } from '@oakestra/ui';
import { ChevronRightIcon, DownloadIcon } from 'lucide-react';
import { useMemo, useState } from 'react';

import { downloadJson } from '../lib/download';
import { CopyButton } from './CopyButton';

interface JsonViewerProps {
  data: unknown;
  title?: string;
  defaultOpen?: boolean;
  /** Adds a download button that saves the data under this file name. */
  downloadAs?: string;
  className?: string;
  /** Tailwind max-height class for the scrolling body. */
  maxHeightClassName?: string;
}

export function JsonViewer({
  data,
  title = 'JSON',
  defaultOpen = true,
  downloadAs,
  className,
  maxHeightClassName = 'max-h-96',
}: JsonViewerProps) {
  const [open, setOpen] = useState(defaultOpen);
  // JSON.stringify returns undefined for undefined input, which would break the copy button.
  const text = useMemo(() => JSON.stringify(data, null, 2) ?? 'null', [data]);

  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      className={cn('rounded-md border bg-muted/30', className)}
    >
      <div className="flex items-center justify-between gap-2 px-2 py-1">
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="sm" className="group gap-1">
            <ChevronRightIcon
              aria-hidden
              className="transition-transform group-data-[state=open]:rotate-90"
            />
            {title}
          </Button>
        </CollapsibleTrigger>
        <div className="flex items-center gap-1">
          <CopyButton value={text} label={`Copy ${title}`} />
          {downloadAs ? (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={`Download ${title}`}
              title={`Download ${title}`}
              onClick={() => downloadJson(downloadAs, data)}
            >
              <DownloadIcon aria-hidden />
            </Button>
          ) : null}
        </div>
      </div>
      <CollapsibleContent>
        <pre
          // Keyboard users need focus on a scrollable region to scroll it.
          // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
          tabIndex={0}
          className={cn(
            'overflow-auto border-t p-3 font-mono text-xs leading-relaxed',
            maxHeightClassName,
          )}
        >
          <code>{text}</code>
        </pre>
      </CollapsibleContent>
    </Collapsible>
  );
}
