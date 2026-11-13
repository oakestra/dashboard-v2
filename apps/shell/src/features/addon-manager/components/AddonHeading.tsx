import type { AddonSourceRef } from '@oakestra/api';
import { cn } from '@oakestra/ui';
import type { ComponentType, ReactNode } from 'react';

import { addonTitle, hasDisplayName } from '../display';
import { AddonIcon } from './AddonIcon';
import { OfficialMark } from './OfficialMark';

interface AddonHeadingProps {
  addon: { display_name?: string; qualified_name: string; icon?: string; source?: AddonSourceRef };
  /** The dialog's own title component, so Radix still labels the dialog with it. */
  title: ComponentType<{ className?: string; children?: ReactNode }>;
  /** Shown after the title on the same line (version, status). */
  children?: ReactNode;
}

/**
 * The header of an addon's details dialog, laid out like its marketplace card: icon, title and
 * the qualified name under a display name.
 */
export function AddonHeading({ addon, title: Title, children }: AddonHeadingProps) {
  return (
    <div className="flex items-center gap-3">
      <AddonIcon icon={addon.icon} name={addonTitle(addon)} />
      <div className="min-w-0 flex-1">
        <Title className="flex flex-wrap items-center gap-x-2 gap-y-1">
          {addonTitle(addon)}
          <OfficialMark source={addon.source} />
          {children}
        </Title>
        <QualifiedName addon={addon} />
      </div>
    </div>
  );
}

/**
 * The qualified name, on its own line under a display name. Any tap can pick any display name,
 * so this is what tells the admin where the addon comes from. Nothing without a display name.
 */
export function QualifiedName({
  addon,
  className,
}: {
  addon: { display_name?: string; qualified_name: string };
  className?: string;
}) {
  if (!hasDisplayName(addon)) return null;
  return (
    <span
      className={cn('text-muted-foreground block truncate font-mono text-xs', className)}
      data-testid="qualified-name"
    >
      {addon.qualified_name}
    </span>
  );
}

/** The Category and Tags rows of a detail view's `<dl>`, each only when it has a value. */
export function AddonClassificationRows({
  category,
  tags,
}: {
  category: string | undefined;
  tags: readonly string[];
}) {
  return (
    <>
      {category ? (
        <>
          <dt className="text-muted-foreground">Category</dt>
          <dd>{category}</dd>
        </>
      ) : null}
      {tags.length > 0 ? (
        <>
          <dt className="text-muted-foreground">Tags</dt>
          <dd className="text-muted-foreground flex flex-wrap gap-x-2">
            {tags.map((tag) => (
              <span key={tag}>#{tag}</span>
            ))}
          </dd>
        </>
      ) : null}
    </>
  );
}
