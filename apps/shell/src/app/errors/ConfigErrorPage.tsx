import { SettingsIcon } from 'lucide-react';

import { OakestraLogo } from '../../components/OakestraLogo';
import { ErrorState } from './ErrorState';

/** Rendered by bootstrap without router or providers, so it may only use plain components. */
export function ConfigErrorPage({ message }: { message: string }) {
  return (
    <div className="bg-background flex min-h-svh flex-col items-center px-4 pt-10">
      <OakestraLogo className="h-7" />
      <ErrorState
        role="alert"
        icon={<SettingsIcon />}
        tone="destructive"
        title="The dashboard is not configured correctly"
        className="w-full flex-1 pt-8"
      >
        <p>
          The runtime configuration (<code className="font-mono text-foreground">/config.json</code>
          ) could not be loaded. Check the container environment variables, usually{' '}
          <code className="font-mono text-foreground">API_URL</code> or{' '}
          <code className="font-mono text-foreground">API_ADDRESS</code>.
        </p>
        <pre className="bg-muted text-foreground mt-4 max-h-64 overflow-auto rounded-md border p-3 text-left font-mono text-xs whitespace-pre-wrap">
          {message}
        </pre>
      </ErrorState>
    </div>
  );
}
