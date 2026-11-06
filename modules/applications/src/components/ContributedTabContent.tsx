import { TabsContent } from '@oakestra/ui';
import { useEffect, type ComponentProps } from 'react';

interface ContributedTabContentProps extends ComponentProps<typeof TabsContent> {
  /** Called when the tab goes away, with its value, so the page can leave it if selected. */
  onRemoved: (value: string) => void;
}

/**
 * The panel of a tab contributed through a slot. An addon can disappear at runtime, and tabs do not
 * notice when the selected value stops existing: the page would be left with an empty panel.
 */
export function ContributedTabContent({ value, onRemoved, ...props }: ContributedTabContentProps) {
  useEffect(() => () => onRemoved(value), [value, onRemoved]);
  return <TabsContent value={value} {...props} />;
}
