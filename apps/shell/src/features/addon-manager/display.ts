/**
 * The name to show for an addon: its display name, or the qualified name that identifies it.
 * A display name is free text from a catalog and anyone's tap can claim any, so wherever it is
 * shown the qualified name has to be visible too.
 */
export function addonTitle(addon: { display_name?: string; qualified_name: string }): string {
  return addon.display_name || addon.qualified_name;
}

/** True when the title is a display name, i.e. the qualified name needs its own line. */
export function hasDisplayName(addon: { display_name?: string; qualified_name: string }): boolean {
  return addonTitle(addon) !== addon.qualified_name;
}
