import { cn, StatusDot, type StatusTone } from '@oakestra/ui';

interface MarkProps {
  tone: StatusTone;
  stale?: boolean;
  pulse?: boolean;
  className?: string;
}

/**
 * A status glyph on the board. Healthy marks are grey instead of the usual green: a screen full of
 * running instances must stay quiet, so that the one failed square stands out (ISA-101).
 */
export function Mark({ tone, stale = false, pulse = false, className }: MarkProps) {
  return (
    <StatusDot
      tone={tone}
      stale={stale}
      pulse={pulse}
      className={cn(
        tone === 'success' && !stale && '[&>span]:bg-muted-foreground',
        // Eight pixels cannot carry a dashed outline, the dashes smear into a blob.
        stale && 'size-2.5 [&>span]:border-[1.5px]',
        className,
      )}
    />
  );
}
