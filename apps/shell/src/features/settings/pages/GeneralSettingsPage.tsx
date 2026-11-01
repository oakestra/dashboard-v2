import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@oakestra/ui';

import { Slot } from '../../../core/extensions/Slot';

export function GeneralSettingsPage() {
  return (
    <div className="space-y-4">
      {/* Core modules and addons add their panels here; Appearance is always present. */}
      <Slot
        point="settings.panels"
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
