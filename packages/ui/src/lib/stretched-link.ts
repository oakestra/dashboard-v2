/**
 * For the main link of a card or list item: its click area grows over the whole item, so the item
 * opens on click with plain link semantics (middle click, focus, screen readers). The item needs
 * `relative`, and anything else interactive in it `relative z-10` to stay on top. Hovering anywhere
 * on the item underlines the link, which is what tells people the whole item opens.
 */
export const stretchedLinkClassName =
  'underline-offset-4 outline-none hover:underline after:absolute after:inset-0 after:rounded-[inherit] focus-visible:after:ring-2 focus-visible:after:ring-ring';
