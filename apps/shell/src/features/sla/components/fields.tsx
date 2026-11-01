import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
  Input,
} from '@oakestra/ui';
import { ChevronDown, Plus, Trash2 } from 'lucide-react';
import { useState, type ComponentProps, type ReactNode } from 'react';
import { get, useFieldArray, useFormContext, type Path } from 'react-hook-form';

import type { ServiceFormValues } from '../model/schema';

type FieldName = Path<ServiceFormValues>;

export function fieldId(name: string): string {
  return `sla-${name.replace(/\./g, '-')}`;
}

/** The error object RHF stores at `name`, if any. */
export function useFieldError(name: string): { message?: string } | undefined {
  const {
    formState: { errors },
  } = useFormContext<ServiceFormValues>();
  const error: { message?: string } | undefined = get(errors, name);
  return error;
}

export function TextField({
  name,
  label,
  description,
  className,
  ...input
}: {
  name: FieldName;
  label: string;
  description?: string;
} & Omit<ComponentProps<typeof Input>, 'name'>) {
  const { register } = useFormContext<ServiceFormValues>();
  const error = useFieldError(name);
  const id = fieldId(name);
  return (
    <Field data-invalid={!!error} className={className}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Input id={id} aria-invalid={!!error} {...register(name)} {...input} />
      {description ? <FieldDescription>{description}</FieldDescription> : null}
      <FieldError errors={[error]} />
    </Field>
  );
}

/**
 * A titled card. With `collapsible` the body is hidden until opened; it opens by itself when it
 * contains a validation error, otherwise a failed submit would point at nothing visible.
 */
export function Section({
  id,
  title,
  description,
  collapsible = false,
  defaultOpen = false,
  hasError = false,
  actions,
  children,
}: {
  id: string;
  title: string;
  description?: string;
  collapsible?: boolean;
  defaultOpen?: boolean;
  hasError?: boolean;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  // Adjusting state while rendering (instead of in an effect) avoids a flash of the closed card.
  const [forcedOpen, setForcedOpen] = useState(false);
  if (hasError && !forcedOpen) {
    setForcedOpen(true);
    setOpen(true);
  } else if (!hasError && forcedOpen) {
    setForcedOpen(false);
  }

  const header = (
    <CardHeader>
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <CardTitle>{title}</CardTitle>
          {description ? <CardDescription>{description}</CardDescription> : null}
        </div>
        {collapsible ? (
          <CollapsibleTrigger asChild>
            <Button type="button" variant="ghost" size="sm" aria-label={`Toggle ${title}`}>
              <ChevronDown
                className={open ? 'rotate-180 transition-transform' : 'transition-transform'}
              />
            </Button>
          </CollapsibleTrigger>
        ) : (
          actions
        )}
      </div>
    </CardHeader>
  );

  if (!collapsible) {
    return (
      <Card id={id}>
        {header}
        <CardContent className="space-y-4">{children}</CardContent>
      </Card>
    );
  }
  return (
    <Card id={id}>
      <Collapsible open={open} onOpenChange={setOpen}>
        {header}
        <CollapsibleContent>
          <CardContent className="space-y-4">{children}</CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

/** Editable list of plain strings (command, arguments, files). */
export function StringListField({
  name,
  label,
  itemLabel,
  placeholder,
  addLabel,
}: {
  name: 'cmd' | 'args' | 'added_files';
  label: string;
  itemLabel: string;
  placeholder?: string;
  addLabel: string;
}) {
  const { control, register } = useFormContext<ServiceFormValues>();
  const { fields, append, remove } = useFieldArray({ control, name });
  return (
    <Field>
      <FieldLabel>{label}</FieldLabel>
      <div className="space-y-2">
        {fields.map((item, index) => (
          <div key={item.id} className="flex gap-2">
            <Input
              aria-label={`${itemLabel} ${index + 1}`}
              placeholder={placeholder}
              {...register(`${name}.${index}.value`)}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={`Remove ${itemLabel.toLowerCase()} ${index + 1}`}
              onClick={() => remove(index)}
            >
              <Trash2 />
            </Button>
          </div>
        ))}
        <Button type="button" variant="outline" size="sm" onClick={() => append({ value: '' })}>
          <Plus /> {addLabel}
        </Button>
      </div>
    </Field>
  );
}
