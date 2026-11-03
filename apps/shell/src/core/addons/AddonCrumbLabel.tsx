import { AddonContext, type AddonCrumbProps } from '@oakestra/dashboard-sdk';
import { Suspense, type ComponentType } from 'react';

import { ErrorBoundary } from '../extensions/ErrorBoundary';
import type { AddonEntry } from './addon-registry';
import { addonSource } from './ui-addons';

interface AddonCrumbLabelProps {
  crumb: ComponentType<AddonCrumbProps>;
  params: AddonCrumbProps['params'];
  entry: AddonEntry;
  /** Shown while the crumb suspends and after it failed, so the trail never has a hole. */
  fallback: string;
}

/**
 * A component crumb of an addon route. It renders in the header, outside the addon's page and its
 * boundary, so it gets its own: a crumb that throws must not take the layout down. The addon
 * context lets it use the SDK's addon hooks like on the page.
 */
export function AddonCrumbLabel({ crumb: Crumb, params, entry, fallback }: AddonCrumbLabelProps) {
  const source = addonSource(entry);
  return (
    <AddonContext.Provider value={source.addon}>
      <ErrorBoundary
        fallback={() => fallback}
        onError={(error) => console.error(`[addon:${entry.name}] crumb crashed`, error)}
      >
        <Suspense fallback={fallback}>
          <Crumb params={params} />
        </Suspense>
      </ErrorBoundary>
    </AddonContext.Provider>
  );
}
