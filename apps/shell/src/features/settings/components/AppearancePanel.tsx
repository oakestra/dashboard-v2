import { ToggleGroup, ToggleGroupItem } from '@oakestra/ui';
import { MonitorIcon, MoonIcon, SunIcon } from 'lucide-react';

import { useTheme } from '../../../core/theme/theme-context';
import type { ThemePreference } from '../../../core/theme/theme';

const OPTIONS = [
  { value: 'light', label: 'Light', icon: SunIcon },
  { value: 'dark', label: 'Dark', icon: MoonIcon },
  { value: 'system', label: 'System', icon: MonitorIcon },
] as const satisfies readonly { value: ThemePreference; label: string; icon: unknown }[];

/** Same store as the account menu, so both stay in step and persist the same way. */
export function AppearancePanel() {
  const theme = useTheme();
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
      <div className="text-sm">
        <div>Theme</div>
        {theme.preference === 'system' ? (
          <div className="text-muted-foreground">
            System follows your operating system, currently {theme.resolved}.
          </div>
        ) : null}
      </div>
      <ToggleGroup
        type="single"
        variant="outline"
        aria-label="Theme"
        value={theme.preference}
        // Radix reports an empty string when the active item is clicked again; keep the choice.
        onValueChange={(value) => {
          if (value) theme.setPreference(value as ThemePreference);
        }}
      >
        {OPTIONS.map(({ value, label, icon: Icon }) => (
          <ToggleGroupItem key={value} value={value} aria-label={label} className="gap-1.5 px-3">
            <Icon aria-hidden />
            {label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  );
}
