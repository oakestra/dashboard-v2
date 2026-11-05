import { AppearancePanel } from '../components/AppearancePanel';

/**
 * Settings of the dashboard itself. Addons have no slot here: an addon's settings belong on its
 * own page, linked as a sub-item of its nav entry, so this page never mixes in addon concerns.
 */
export function GeneralSettingsPage() {
  return (
    <section aria-label="Appearance" className="bg-card max-w-3xl divide-y rounded-lg border">
      <h2 className="px-4 py-2.5 text-sm font-semibold">Appearance</h2>
      <AppearancePanel />
    </section>
  );
}
