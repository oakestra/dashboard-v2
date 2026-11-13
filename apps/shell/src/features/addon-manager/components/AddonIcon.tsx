import { cn, initials } from '@oakestra/ui';
import { PuzzleIcon } from 'lucide-react';

import { AddonIconImage } from '../../../core/addons/AddonIconImage';

const SIZES = {
  sm: { box: 'size-8 rounded-md text-[0.6875rem]', glyph: 'size-4' },
  md: { box: 'size-10 rounded-lg text-xs', glyph: 'size-5' },
} as const;

/**
 * An addon's catalog icon. Falls back to the initials of `name` (a grid of identical puzzle
 * pieces is hard to scan), then to the puzzle.
 */
export function AddonIcon({
  icon,
  name,
  size = 'md',
  className,
}: {
  icon: string | undefined;
  /** The title the addon is shown under; a qualified name contributes only its last part. */
  name?: string;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const { box, glyph } = SIZES[size];
  const monogram = name ? initials(name.split('/').pop() ?? name) : '';
  return (
    <span
      aria-hidden
      data-testid="addon-icon"
      className={cn(
        'bg-background text-muted-foreground flex shrink-0 items-center justify-center overflow-hidden border',
        box,
        className,
      )}
    >
      <AddonIconImage
        src={icon}
        className="size-full"
        fallback={
          monogram ? (
            <span className="font-semibold tracking-tight" data-testid="addon-icon-placeholder">
              {monogram}
            </span>
          ) : (
            <PuzzleIcon className={glyph} data-testid="addon-icon-placeholder" />
          )
        }
      />
    </span>
  );
}
