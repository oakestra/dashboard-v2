import { Popover as PopoverPrimitive } from 'radix-ui';
import { useMemo, type ReactNode } from 'react';

/** The rendered node in the frame, looked up on every measure: pan and zoom move it. */
function nodeElement(frame: HTMLElement | null, nodeId: string) {
  if (!frame) return undefined;
  return (
    frame.querySelector<HTMLElement>(`.react-flow__node[data-id="${CSS.escape(nodeId)}"]`) ??
    undefined
  );
}

/**
 * The hover card of one node. A Radix popover on a virtual anchor (the node's screen rect), so it
 * is portalled out of the frame's `overflow-hidden` and flips at the window's edges like every
 * other popover here. Purely informational: no focus is moved into it, it takes no pointer
 * events, and the graph decides when it closes.
 */
export function FlowHoverCard({
  frame,
  nodeId,
  side,
  onClose,
  children,
}: {
  frame: HTMLElement | null;
  nodeId: string;
  side: 'bottom' | 'right';
  onClose: () => void;
  children: ReactNode;
}) {
  const anchor = useMemo(
    () => ({
      current: {
        getBoundingClientRect: () =>
          nodeElement(frame, nodeId)?.getBoundingClientRect() ?? new DOMRect(),
      },
    }),
    [frame, nodeId],
  );
  return (
    <PopoverPrimitive.Root open modal={false} onOpenChange={(open) => !open && onClose()}>
      <PopoverPrimitive.Anchor virtualRef={anchor} />
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          role="tooltip"
          data-slot="flow-hover-card"
          side={side}
          align="start"
          sideOffset={8}
          collisionPadding={8}
          // The card follows hover and focus in the graph; Radix must not move focus or close it on
          // its own, except on Escape.
          onOpenAutoFocus={(event) => event.preventDefault()}
          onCloseAutoFocus={(event) => event.preventDefault()}
          onFocusOutside={(event) => event.preventDefault()}
          onPointerDownOutside={(event) => event.preventDefault()}
          className="pointer-events-none z-50 max-w-72 rounded-xl border bg-popover p-3 text-sm text-popover-foreground shadow-md outline-hidden motion-safe:animate-in motion-safe:fade-in-0"
        >
          {children}
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
