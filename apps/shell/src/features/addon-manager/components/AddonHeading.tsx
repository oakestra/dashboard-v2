import type { ComponentType, ReactNode } from 'react';

import { addonTitle, hasDisplayName } from '../display';
import { AddonIcon } from './AddonIcon';

interface AddonHeadingProps {
  addon: { display_name?: string; qualified_name: string; icon?: string };
  /** The dialog's or sheet's own title component, so Radix still labels the dialog with it. */
  title: ComponentType<{ className?: string; children?: ReactNode }>;
  /** Shown after the title on the same line (version, status). */
  children?: ReactNode;
}

/**
 * The header of an addon's sheet or dialog, laid out like its marketplace card: icon, title and
 * the qualified name under a display name.
 */
export function AddonHeading({ addon, title: Title, children }: AddonHeadingProps) {
  return (
    <div className="flex items-center gap-3">
      <AddonIcon icon={addon.icon} />
      <div className="min-w-0 flex-1">
        <Title className="flex flex-wrap items-center gap-x-2 gap-y-1">
          {addonTitle(addon)}
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
}: {
  addon: { display_name?: string; qualified_name: string };
}) {
  if (!hasDisplayName(addon)) return null;
  return (
    <div className="text-muted-foreground truncate font-mono text-xs" data-testid="qualified-name">
      {addon.qualified_name}
    </div>
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
