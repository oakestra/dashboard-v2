import { Button, cn } from '@oakestra/ui';
import { CheckIcon, CopyIcon } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { notify } from '../core/notify/notify';

interface CopyButtonProps {
  value: string;
  /** Accessible name; also the tooltip. */
  label?: string;
  className?: string;
  size?: 'icon' | 'icon-sm' | 'icon-xs';
  variant?: 'ghost' | 'outline' | 'secondary';
}

export function CopyButton({
  value,
  label = 'Copy to clipboard',
  className,
  size = 'icon-sm',
  variant = 'ghost',
}: CopyButtonProps) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      // Clipboard access is denied on insecure origins and in some embedded contexts.
      notify.error('Could not copy to the clipboard');
      return;
    }
    setCopied(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 1500);
  }

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      className={cn(className)}
      aria-label={copied ? 'Copied' : label}
      title={label}
      onClick={() => void copy()}
    >
      {copied ? <CheckIcon aria-hidden /> : <CopyIcon aria-hidden />}
    </Button>
  );
}
