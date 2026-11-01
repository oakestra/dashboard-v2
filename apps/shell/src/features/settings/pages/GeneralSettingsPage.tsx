import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  EmptyState,
} from '@oakestra/ui';
import { SlidersHorizontalIcon } from 'lucide-react';

import { Slot } from '../../../core/extensions/Slot';

// The theme lives in the account menu (top right), not here, so there is one place to change it.
export function GeneralSettingsPage() {
  return (
    <div className="space-y-6">
      {/* Addons (and later core modules) add their settings here. */}
      <Slot
        point="settings.panels"
        empty={
          <EmptyState
            icon={<SlidersHorizontalIcon aria-hidden />}
            title="No settings yet"
            description="Installed addons can add their settings here. The theme is in the account menu at the top right."
          />
        }
        render={(panel, content, source) => (
          <Card data-testid="settings-panel" data-panel-id={`${source.id}:${panel.id}`}>
            <CardHeader>
              <CardTitle>{panel.title}</CardTitle>
              {panel.description ? <CardDescription>{panel.description}</CardDescription> : null}
            </CardHeader>
            <CardContent>{content}</CardContent>
          </Card>
        )}
      />
    </div>
  );
}
