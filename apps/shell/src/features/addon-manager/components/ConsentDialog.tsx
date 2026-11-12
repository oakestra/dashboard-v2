import type { ConsentRequest } from '@oakestra/api';
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Button,
  Checkbox,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Label,
} from '@oakestra/ui';
import { ShieldAlertIcon, TriangleAlertIcon } from 'lucide-react';
import { useState, type ReactNode } from 'react';

import { hasDangerousPermissions } from '../permissions';
import { DefinitionDetails } from './DefinitionDetails';
import { PermissionList } from './PermissionList';

export interface ConsentReview {
  title: string;
  description?: ReactNode;
  confirmLabel: string;
  request: ConsentRequest;
  /**
   * The backend answered with another definition than the one the admin was shown (the catalog
   * changed in between), so the dialog came back.
   */
  changed?: boolean;
}

interface ConsentDialogProps {
  review: ConsentReview | null;
  pending: boolean;
  /** Accepts exactly `review.request.definitionHash`. */
  onConfirm: (hash: string) => void;
  onCancel: () => void;
}

/**
 * Shows the definition the addons-manager is about to store (images with digests, mounts,
 * environment names, permissions) before the admin accepts it. The backend only installs,
 * updates or re-approves when the hash of exactly this definition is echoed back, so confirming
 * here is what the grant is based on.
 */
export function ConsentDialog({ review, pending, onConfirm, onCancel }: ConsentDialogProps) {
  return (
    <Dialog open={review !== null} onOpenChange={(open) => !open && !pending && onCancel()}>
      <DialogContent
        className="flex max-h-[85vh] flex-col sm:max-w-2xl"
        data-testid="consent-dialog"
      >
        {/* Keyed by hash, so a changed definition starts with the acknowledgement unticked. */}
        {review ? (
          <ReviewBody
            key={review.request.definitionHash}
            review={review}
            pending={pending}
            onConfirm={onConfirm}
            onCancel={onCancel}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function ReviewBody({
  review,
  pending,
  onConfirm,
  onCancel,
}: Omit<ConsentDialogProps, 'review'> & { review: ConsentReview }) {
  const { request } = review;
  const { definition } = request;
  const dangerous = hasDangerousPermissions(request.permissions);
  const [acknowledged, setAcknowledged] = useState(false);

  return (
    <>
      <DialogHeader>
        <DialogTitle>{review.title}</DialogTitle>
        <DialogDescription>
          {review.description ?? 'Review what this addon runs and may do on the host.'}
        </DialogDescription>
      </DialogHeader>
      {/* A plain overflow box: Radix's ScrollArea viewport doesn't take the flexed height here,
          so a long definition spilled over the acknowledgement and the footer. */}
      <div className="-mx-2 min-h-0 flex-1 overflow-y-auto px-2" data-testid="consent-body">
        <div className="space-y-4">
          {review.changed ? (
            <Alert variant="warning" data-testid="definition-changed">
              <AlertTitle>The definition changed</AlertTitle>
              <AlertDescription>
                The marketplace now serves another definition than the one shown before. Review it
                again.
              </AlertDescription>
            </Alert>
          ) : null}
          <p className="text-sm" data-testid="consent-version">
            {request.previousVersion ? (
              <>
                Version <span className="tabular-nums">{request.previousVersion}</span> to{' '}
                <span className="font-medium tabular-nums">{definition.version}</span>
              </>
            ) : (
              <>
                Version <span className="font-medium tabular-nums">{definition.version}</span>
              </>
            )}
          </p>
          {request.permissionsGrow ? (
            <Alert variant="warning" data-testid="permissions-grow">
              <TriangleAlertIcon aria-hidden />
              <AlertTitle>This version asks for more permissions</AlertTitle>
              <AlertDescription>
                Permissions marked New were not granted to the installed version.
              </AlertDescription>
            </Alert>
          ) : null}

          <section className="space-y-2" aria-label="Permissions">
            <h3 className="text-sm font-semibold">Permissions</h3>
            <PermissionList
              permissions={request.permissions}
              previous={request.previousPermissions}
            />
          </section>
          {dangerous ? (
            <Alert variant="destructive">
              <ShieldAlertIcon aria-hidden />
              <AlertTitle>This addon gets control over the platform</AlertTitle>
              <AlertDescription>
                Dangerous permissions are as good as root on the host or on the control plane. Only
                accept them for addons from a source you trust.
              </AlertDescription>
            </Alert>
          ) : null}

          <section className="space-y-2 border-t pt-4" aria-label="Definition">
            <p className="text-muted-foreground text-xs">
              You accept exactly this definition: the images below, pinned by digest, and their
              settings. If the marketplace serves anything else later, it has to be accepted again.
            </p>
            <DefinitionDetails
              services={definition.services}
              volumes={definition.volumes}
              networks={definition.networks}
            />
          </section>
        </div>
      </div>
      {dangerous ? (
        <div className="flex items-start gap-2">
          <Checkbox
            id="accept-dangerous-permissions"
            checked={acknowledged}
            onCheckedChange={(checked) => setAcknowledged(checked === true)}
            disabled={pending}
          />
          <Label htmlFor="accept-dangerous-permissions" className="leading-snug font-normal">
            I understand that this addon gets the dangerous permissions listed above.
          </Label>
        </div>
      ) : null}
      <DialogFooter>
        <Button variant="outline" onClick={onCancel} disabled={pending}>
          Cancel
        </Button>
        <Button
          disabled={pending || (dangerous && !acknowledged)}
          onClick={() => onConfirm(request.definitionHash)}
        >
          {pending ? 'Working...' : review.confirmLabel}
        </Button>
      </DialogFooter>
    </>
  );
}
