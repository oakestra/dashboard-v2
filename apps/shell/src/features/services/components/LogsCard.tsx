import {
  Button,
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  EmptyState,
} from '@oakestra/ui';
import { DownloadIcon, ScrollTextIcon } from 'lucide-react';
import { useLayoutEffect, useRef } from 'react';

import { CopyButton } from '../../../components/CopyButton';
import { formatRelativeTime } from '../../../lib/format';

function downloadText(filename: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  // Revoking synchronously can cancel the download in some browsers.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

interface LogsCardProps {
  logs: string | undefined;
  filename: string;
  /** When the data was last fetched, in epoch ms. */
  updatedAt: number;
}

export function LogsCard({ logs, filename, updatedAt }: LogsCardProps) {
  const ref = useRef<HTMLPreElement>(null);
  const atBottom = useRef(true);

  // Follow new output only while the reader is at the end; scrolling up to read must not be undone
  // by the next refresh.
  useLayoutEffect(() => {
    const element = ref.current;
    if (element && atBottom.current) element.scrollTop = element.scrollHeight;
  }, [logs]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Logs</CardTitle>
        <CardDescription>Updated {formatRelativeTime(updatedAt)}</CardDescription>
        {logs ? (
          <CardAction className="flex gap-2">
            <CopyButton value={logs} label="Copy logs" text="Copy" variant="outline" />
            <Button
              variant="outline"
              size="sm"
              aria-label="Download logs"
              onClick={() => downloadText(filename, logs)}
            >
              <DownloadIcon aria-hidden />
              Download
            </Button>
          </CardAction>
        ) : null}
      </CardHeader>
      <CardContent>
        {logs ? (
          <pre
            ref={ref}
            onScroll={(event) => {
              const el = event.currentTarget;
              atBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 24;
            }}
            // Keyboard users need focus on a scrollable region to scroll it.
            // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
            tabIndex={0}
            data-testid="instance-logs"
            className="max-h-96 overflow-auto rounded-md bg-muted/40 p-3 font-mono text-xs leading-relaxed whitespace-pre-wrap"
          >
            {logs}
          </pre>
        ) : (
          <EmptyState
            icon={<ScrollTextIcon />}
            title="No logs yet"
            description="Output appears here once the instance has written something."
          />
        )}
      </CardContent>
    </Card>
  );
}
