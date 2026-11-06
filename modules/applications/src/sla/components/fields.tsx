import {
  Button,
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  cn,
  plural,
} from '@oakestra/ui';
import { ChevronDown, Eye, EyeOff, Plus, Trash2 } from 'lucide-react';
import { useState, type ComponentProps, type ReactNode } from 'react';
import {
  Controller,
  get,
  useFieldArray,
  useFormContext,
  useFormState,
  type Path,
} from 'react-hook-form';

import type { ServiceFormValues } from '../model/schema';
import { hasErrorsInSection, type FormSectionId } from './SectionNav';

type FieldName = Path<ServiceFormValues>;

/** Summary text of a closed section. */
export function count(n: number, noun: string): string {
  return n === 0 ? 'None' : plural(n, noun);
}

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

/** Gap between a label and its control. */
export const FIELD_GAP = 'gap-1.5';

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
    <Field data-invalid={!!error} className={cn(FIELD_GAP, className)}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Input id={id} aria-invalid={!!error} {...register(name)} {...input} />
      {description ? <FieldDescription>{description}</FieldDescription> : null}
      <FieldError errors={[error]} />
    </Field>
  );
}

/**
 * A titled panel. With `collapsible` the body is hidden until opened; it opens by itself when it
 * contains a validation error, otherwise a failed submit would point at nothing visible.
 * `summary` is shown on the right while the panel is closed ("2 constraints", "None").
 */
export function Section({
  id,
  title,
  description,
  collapsible = false,
  defaultOpen = false,
  summary,
  actions,
  children,
}: {
  id: FormSectionId;
  title: string;
  description?: string;
  collapsible?: boolean;
  defaultOpen?: boolean;
  summary?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const { errors } = useFormState<ServiceFormValues>();
  const hasError = collapsible && hasErrorsInSection(id, errors);
  const [open, setOpen] = useState(defaultOpen);
  // Adjusting state while rendering (instead of in an effect) avoids a flash of the closed panel.
  const [forcedOpen, setForcedOpen] = useState(false);
  if (hasError && !forcedOpen) {
    setForcedOpen(true);
    setOpen(true);
  } else if (!hasError && forcedOpen) {
    setForcedOpen(false);
  }

  const header = (
    <>
      <span className="min-w-0">
        <span className="block text-sm leading-snug font-semibold">{title}</span>
        {description ? (
          <span className="block text-xs text-muted-foreground">{description}</span>
        ) : null}
      </span>
    </>
  );
  if (!collapsible) {
    return (
      <section id={id} className="scroll-mt-20 rounded-lg border bg-card text-card-foreground">
        <div className="flex items-start justify-between gap-3 border-b px-4 py-2.5">
          {header}
          {actions}
        </div>
        <div className="space-y-4 px-4 py-4">{children}</div>
      </section>
    );
  }
  return (
    <section id={id} className="scroll-mt-20 rounded-lg border bg-card text-card-foreground">
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger
          aria-label={`Toggle ${title}`}
          className={cn(
            'flex w-full cursor-pointer items-center justify-between gap-3 rounded-lg px-4 py-2.5 text-left outline-none hover:bg-muted/60 focus-visible:bg-muted/60',
            open && 'rounded-b-none border-b',
          )}
        >
          {header}
          <span className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
            {!open && summary ? <span>{summary}</span> : null}
            <ChevronDown
              aria-hidden
              className={cn('size-4 text-muted-foreground/60', open && 'rotate-180')}
            />
          </span>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="space-y-4 px-4 py-4">{children}</div>
        </CollapsibleContent>
      </Collapsible>
    </section>
  );
}

/** Shared option list for the form's selects: Radix `Select` bound to a form field. */
export function FormSelect({
  name,
  options,
  placeholder,
  id,
  'aria-label': ariaLabel,
  invalid = false,
  className,
}: {
  name: FieldName;
  options: readonly { value: string; label: string }[];
  placeholder?: string;
  id?: string;
  'aria-label'?: string;
  invalid?: boolean;
  className?: string;
}) {
  const { control } = useFormContext<ServiceFormValues>();
  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <Select
          // Radix reserves "" for "nothing selected", so an empty field becomes undefined.
          value={(field.value as string | undefined) || undefined}
          onValueChange={field.onChange}
        >
          <SelectTrigger
            id={id}
            aria-label={ariaLabel}
            aria-invalid={invalid}
            className={cn('w-full', className)}
            onBlur={field.onBlur}
          >
            <SelectValue placeholder={placeholder} />
          </SelectTrigger>
          <SelectContent>
            {options.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    />
  );
}

/** Masked text input with a reveal toggle, for values that may be secrets. */
export function SecretInput({
  label,
  ...input
}: { label: string } & Omit<ComponentProps<typeof Input>, 'type'>) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <Input
        {...input}
        aria-label={label}
        type={visible ? 'text' : 'password'}
        autoComplete="off"
        className={cn('pr-9', input.className)}
      />
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        className="absolute top-1/2 right-1.5 -translate-y-1/2"
        aria-label={`${visible ? 'Hide' : 'Show'} ${label.toLowerCase()}`}
        aria-pressed={visible}
        onClick={() => setVisible((value) => !value)}
      >
        {visible ? <EyeOff aria-hidden /> : <Eye aria-hidden />}
      </Button>
    </div>
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
    <Field className={FIELD_GAP}>
      <FieldLabel>{label}</FieldLabel>
      <div className="space-y-1.5">
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
              size="icon-sm"
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
