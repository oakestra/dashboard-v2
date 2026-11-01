import { zodResolver } from '@hookform/resolvers/zod';
import type { Application, SlaMicroservice } from '@oakestra/api';
import { useNotify } from '@oakestra/dashboard-sdk';
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Button,
  ConfirmDialog,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@oakestra/ui';
import { Download } from 'lucide-react';
import { useRef, useState } from 'react';
import { FormProvider, useForm, useWatch } from 'react-hook-form';
import { useNavigate } from 'react-router';

import { describeError } from '../../../core/api/errors';
import { downloadJson } from '../../../lib/download';
import { useDeleteService } from '../../services';
import { useCreateServices } from '../api/mutations';
import { buildSla, importSla, type SlaContext } from '../model/document';
import { fromSlaMicroservice, toSlaMicroservice } from '../model/convert';
import { serviceFormSchema, type ServiceFormValues } from '../model/schema';
import { AddressesSection } from './AddressesSection';
import { AdvancedSection } from './AdvancedSection';
import { BasicsSection } from './BasicsSection';
import { CommandSection } from './CommandSection';
import { ConnectivitySection } from './ConnectivitySection';
import { ConstraintsSection } from './ConstraintsSection';
import { ImportPanel } from './ImportPanel';
import { ResourcesSection } from './ResourcesSection';
import { countErrors, SectionNav } from './SectionNav';

export function ServiceForm({
  application,
  customerId,
  initialValues,
  source,
}: {
  application: Application;
  customerId: string;
  initialValues: ServiceFormValues;
  /** The service this form copies; offers to delete it once the copy exists. */
  source?: { id: string; name: string };
}) {
  const navigate = useNavigate();
  const notify = useNotify();
  const create = useCreateServices(application._id);
  const form = useForm<ServiceFormValues>({
    resolver: zodResolver(serviceFormSchema),
    defaultValues: initialValues,
  });
  const { errors, submitCount } = form.formState;
  const errorCount = countErrors(errors);
  const formRef = useRef<HTMLFormElement>(null);

  const context: SlaContext = { customerId, application };
  const [importError, setImportError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [pending, setPending] = useState<SlaMicroservice[] | null>(null);

  const appPath = `/applications/${application._id}`;
  const removeSource = useDeleteService();
  const [landing, setLanding] = useState<string | null>(null);

  function finish(result: {
    job_id?: string | undefined;
    deployed_services: unknown[];
    failed_services: unknown[];
  }) {
    // `job_id` is the last inserted service, which after a partial failure may be one that was
    // rolled back, and with several services there is no single page to land on.
    const single = result.deployed_services.length === 1 && result.failed_services.length === 0;
    const id = single ? result.job_id : undefined;
    const target = typeof id === 'string' && id ? `${appPath}/services/${id}` : appPath;
    if (source) setLanding(target);
    else void navigate(target);
  }

  function onValid(values: ServiceFormValues) {
    create.mutate(buildSla(context, [toSlaMicroservice(values)]), { onSuccess: finish });
  }

  function onImport(text: string) {
    const result = importSla(text, context);
    if (!result.ok) {
      setImportError(result.error);
      setWarnings([]);
      return;
    }
    setImportError(null);
    setWarnings(result.warnings);
    const [only, ...rest] = result.microservices;
    if (only && rest.length === 0) {
      form.reset(fromSlaMicroservice(only));
      notify.success('SLA imported', { description: 'Review the values and create the service.' });
    } else {
      setPending(result.microservices);
    }
  }

  async function onExport() {
    if (!(await form.trigger())) {
      notify.error('Fix the highlighted fields before exporting');
      return;
    }
    const values = form.getValues();
    const sla = buildSla(context, [toSlaMicroservice(values)]);
    downloadJson(`${values.name}.sla`, sla);
  }

  const [watchedName, watchedNamespace] = useWatch({
    control: form.control,
    name: ['name', 'namespace'],
  });

  return (
    <FormProvider {...form}>
      <div className="grid items-start gap-8 xl:grid-cols-[minmax(0,1fr)_13rem]">
        <form
          ref={formRef}
          className="max-w-4xl min-w-0 space-y-6 pb-4"
          noValidate
          onSubmit={(event) => void form.handleSubmit(onValid)(event)}
        >
          <ImportPanel onText={onImport} error={importError} warnings={warnings} />

          <BasicsSection />
          <ResourcesSection />
          <CommandSection />
          <ConstraintsSection hasError={!!errors.constraints} />
          <ConnectivitySection applicationId={application._id} hasError={!!errors.connectivity} />
          <AddressesSection hasError={!!errors.addresses} />
          <AdvancedSection
            hasError={
              !!(
                errors.state ||
                errors.target_node ||
                errors.sla_violation_strategy ||
                errors.added_files
              )
            }
          />

          {create.isError ? (
            <Alert variant="destructive">
              <AlertTitle>Could not create the service</AlertTitle>
              <AlertDescription>{describeError(create.error)}</AlertDescription>
            </Alert>
          ) : null}

          <div className="bg-background/95 sticky bottom-0 z-10 -mx-1 flex flex-wrap items-center justify-between gap-3 border-t px-1 py-3 backdrop-blur">
            {submitCount > 0 && errorCount > 0 ? (
              <button
                type="button"
                aria-live="polite"
                className="text-destructive cursor-pointer text-sm font-medium hover:underline"
                onClick={() =>
                  formRef.current
                    ?.querySelector<HTMLElement>('[aria-invalid="true"]')
                    ?.scrollIntoView({ behavior: 'smooth', block: 'center' })
                }
              >
                {errorCount === 1
                  ? '1 field needs attention'
                  : `${errorCount} fields need attention`}
              </button>
            ) : (
              <p className="text-muted-foreground truncate text-sm">
                {application.application_name} /{' '}
                <span className="text-foreground font-medium">
                  {watchedName ? `${watchedName}.${watchedNamespace}` : 'New service'}
                </span>
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="ghost" onClick={() => void navigate(appPath)}>
                Cancel
              </Button>
              <Button type="button" variant="outline" onClick={() => void onExport()}>
                <Download /> Download SLA
              </Button>
              <Button type="submit" disabled={create.isPending}>
                {create.isPending ? 'Creating...' : 'Create service'}
              </Button>
            </div>
          </div>
        </form>
        <SectionNav errors={errors} />
      </div>

      {source ? (
        <ConfirmDialog
          open={landing !== null}
          onOpenChange={(open) => {
            if (!open && landing) void navigate(landing);
          }}
          title={`Delete the original ${source.name}?`}
          description="The copy was created. Services cannot be edited yet, so the original is only needed if you want to keep both."
          confirmLabel="Delete original"
          cancelLabel="Keep original"
          destructive
          pending={removeSource.isPending}
          onConfirm={() =>
            removeSource.mutate(source.id, {
              onSettled: () => {
                if (landing) void navigate(landing);
              },
            })
          }
        />
      ) : null}

      <Dialog open={pending !== null} onOpenChange={(open) => !open && setPending(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>This file contains {pending?.length} services</DialogTitle>
            <DialogDescription>
              The form edits one service at a time. Load one into the form to review it, or create
              all of them as they are.
            </DialogDescription>
          </DialogHeader>
          <ul className="space-y-2">
            {pending?.map((service, index) => (
              <li
                key={`${service.microservice_name}-${index}`}
                className="flex items-center justify-between gap-3 rounded-md border p-2"
              >
                <span className="text-sm">
                  {service.microservice_name}.{service.microservice_namespace}
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  aria-label={`Load ${service.microservice_name} into the form`}
                  onClick={() => {
                    form.reset(fromSlaMicroservice(service));
                    setPending(null);
                  }}
                >
                  Load into form
                </Button>
              </li>
            ))}
          </ul>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setPending(null)}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={create.isPending}
              onClick={() => {
                if (!pending) return;
                create.mutate(buildSla(context, pending), {
                  onSuccess: (result) => {
                    setPending(null);
                    finish(result);
                  },
                  onError: () => setPending(null),
                });
              }}
            >
              {create.isPending ? 'Creating...' : `Create all ${pending?.length} services`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </FormProvider>
  );
}
