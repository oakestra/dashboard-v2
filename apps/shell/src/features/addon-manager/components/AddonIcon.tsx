import { cn } from '@oakestra/ui';
import { PuzzleIcon } from 'lucide-react';

import { AddonIconImage } from '../../../core/addons/AddonIconImage';

const SIZES = {
  sm: { box: 'size-8 rounded-md', glyph: 'size-4' },
  md: { box: 'size-10 rounded-lg', glyph: 'size-5' },
} as const;

/** An addon's catalog icon in a fixed box, or the puzzle placeholder when it has none. */
export function AddonIcon({
  icon,
  size = 'md',
  className,
}: {
  icon: string | undefined;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const { box, glyph } = SIZES[size];
  return (
    <span
      aria-hidden
      data-testid="addon-icon"
      className={cn(
        'bg-muted text-muted-foreground flex shrink-0 items-center justify-center overflow-hidden',
        box,
        className,
      )}
    >
      <AddonIconImage
        src={icon}
        className="size-full"
        fallback={<PuzzleIcon className={glyph} data-testid="addon-icon-placeholder" />}
      />
    </span>
  );
}
