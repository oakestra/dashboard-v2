import type { IconProps } from '@oakestra/dashboard-sdk';
import { cn } from '@oakestra/ui';
import { useState, type ComponentType, type ReactNode } from 'react';

import { isHttpsUrl } from './ui-addons';

interface AddonIconImageProps {
  /** The `icon` of an addon definition: a URL on a third-party host, or nothing. */
  src: string | undefined;
  className?: string;
  /** Rendered instead when there is no usable URL or the image fails to load. */
  fallback?: ReactNode;
}

/**
 * An addon's catalog icon. The URL comes from a third-party index, so it is only ever an
 * `<img src>`: `no-referrer` keeps the dashboard URL out of the icon host's logs, and anything
 * but https is not loaded at all. Decorative, since the addon's name is always next to it.
 */
export function AddonIconImage({ src, className, fallback = null }: AddonIconImageProps) {
  // Keyed by URL, so a changed icon gets its own chance to load.
  const [failed, setFailed] = useState<string | undefined>();
  if (!src || !isHttpsUrl(src) || failed === src) return fallback;
  return (
    <img
      src={src}
      alt=""
      referrerPolicy="no-referrer"
      loading="lazy"
      decoding="async"
      draggable={false}
      className={cn('object-contain', className)}
      onError={() => setFailed(src)}
    />
  );
}

const navIcons = new Map<string, ComponentType<IconProps>>();

/**
 * A nav item icon showing the catalog icon. One component per URL, so React keeps the same
 * element across registry updates instead of remounting (and refetching) it.
 */
export function addonNavIcon(src: string): ComponentType<IconProps> {
  let icon = navIcons.get(src);
  if (!icon) {
    icon = function AddonNavIcon({ className }: IconProps) {
      return <AddonIconImage src={src} className={cn('rounded-sm', className)} />;
    };
    navIcons.set(src, icon);
  }
  return icon;
}
