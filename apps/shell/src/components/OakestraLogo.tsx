import { cn } from '@oakestra/ui';

export interface OakestraLogoProps {
  /** `wordmark` is the full "Oakestra" lettering, `mark` the round tree on its own. */
  variant?: 'wordmark' | 'mark';
  className?: string;
}

const SOURCES = {
  wordmark: { light: '/brand/oakestra-wordmark.png', dark: '/brand/oakestra-wordmark-dark.png' },
  mark: { light: '/brand/oakestra-mark.png', dark: '/brand/oakestra-mark-dark.png' },
} as const;

/**
 * The official Oakestra logo in the variant that fits the current theme.
 *
 * Both images are rendered and CSS picks one, because the theme lives in a class on <html> that
 * can flip at any time (system preference changes, other tabs) without a React re-render here.
 * Size it with a height class, the width follows the image's aspect ratio.
 */
export function OakestraLogo({ variant = 'wordmark', className }: OakestraLogoProps) {
  const { light, dark } = SOURCES[variant];
  return (
    <>
      <img src={light} alt="Oakestra" className={cn('w-auto dark:hidden', className)} />
      <img src={dark} alt="Oakestra" className={cn('hidden w-auto dark:block', className)} />
    </>
  );
}
