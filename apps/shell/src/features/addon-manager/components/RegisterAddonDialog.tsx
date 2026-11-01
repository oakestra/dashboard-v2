import { registerAddonInputSchema, type RegisterAddonInput } from '@oakestra/api';
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
  Textarea,
} from '@oakestra/ui';
import { UploadIcon } from 'lucide-react';
import { useRef, useState } from 'react';

import { describeError } from '../../../core/api/errors';
import { useRegisterAddon } from '../api/mutations';

const PLACEHOLDER = `{
  "name": "my-addon",
  "description": "What the addon does",
  "services": [
    { "service_name": "my-addon", "image": "ghcr.io/me/my-addon:1.0.0" }
  ]
}`;

/** `services.0.image` as `services[0].image`, the way a JSON author counts. */
function formatPath(path: readonly PropertyKey[]): string {
  return path.reduce<string>((text, part) => {
    if (typeof part === 'number') return `${text}[${part}]`;
    return text ? `${text}.${String(part)}` : String(part);
  }, '');
}

/**
 * Where JSON.parse gave up, as "line 3, column 7". Only numbers are taken from the engine's
 * message: V8 quotes the start of the input in it, and that is where a pasted token or password
 * would end up on screen.
 */
function jsonErrorLocation(text: string, error: unknown): string | undefined {
  const message = error instanceof Error ? error.message : '';
  const lineColumn = /\(line (\d+) column (\d+)\)$/.exec(message);
  if (lineColumn) return `line ${lineColumn[1]}, column ${lineColumn[2]}`;
  const position = /at position (\d+)$/.exec(message);
  if (!position) return undefined;
  const before = text.slice(0, Number(position[1]));
  const lines = before.split('\n');
  return `line ${lines.length}, column ${lines[lines.length - 1]!.length + 1}`;
}

type Parsed = { ok: true; input: RegisterAddonInput } | { ok: false; errors: string[] };

function parseDefinition(text: string): Parsed {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch (error) {
    const location = jsonErrorLocation(text, error);
    return {
      ok: false,
      errors: [`This is not valid JSON${location ? ` (${location})` : ''}.`],
    };
  }
  const result = registerAddonInputSchema.safeParse(json);
  if (result.success) return { ok: true, input: json as RegisterAddonInput };
  return {
    ok: false,
    errors: result.error.issues.map((issue) => {
      const path = formatPath(issue.path);
      return path ? `${path}: ${issue.message}` : issue.message;
    }),
  };
}

interface RegisterAddonDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function RegisterAddonDialog({ open, onOpenChange }: RegisterAddonDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        {/* Mounted only while open, so a closed dialog does not keep a stale draft or error. */}
        <RegisterForm onDone={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}

function RegisterForm({ onDone }: { onDone: () => void }) {
  const register = useRegisterAddon();
  const [text, setText] = useState('');
  const [errors, setErrors] = useState<string[]>([]);
  const fileInput = useRef<HTMLInputElement>(null);

  function submit() {
    const parsed = parseDefinition(text);
    if (!parsed.ok) {
      setErrors(parsed.errors);
      return;
    }
    setErrors([]);
    register.mutate(parsed.input, { onSuccess: onDone });
  }

  async function importFile(file: File | undefined) {
    if (!file) return;
    setText(await file.text());
    setErrors([]);
    register.reset();
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Register an addon</DialogTitle>
        <DialogDescription>
          Paste the addon definition as JSON or import a file. New definitions go through a review
          first and show up in the marketplace once they are approved (until then they are
          &quot;under review&quot;).
        </DialogDescription>
      </DialogHeader>

      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <Field data-invalid={errors.length > 0 || undefined}>
          <FieldLabel htmlFor="addon-definition">Definition (JSON)</FieldLabel>
          <Textarea
            id="addon-definition"
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder={PLACEHOLDER}
            rows={12}
            spellCheck={false}
            className="font-mono text-xs"
            aria-invalid={errors.length > 0 || undefined}
            aria-describedby="addon-definition-help"
          />
          <FieldDescription id="addon-definition-help">
            Environment values are sent to the marketplace as entered. Use the <code>ui</code> block
            (<code>{'{ "service", "sdk" }'}</code>) to ship a dashboard UI: the current backend does
            not accept it yet and rejects such definitions until that change lands.
          </FieldDescription>
          {errors.length > 0 ? (
            <FieldError data-testid="register-errors">
              <ul className="list-inside list-disc">
                {errors.map((error) => (
                  <li key={error}>{error}</li>
                ))}
              </ul>
            </FieldError>
          ) : null}
        </Field>

        <div>
          <input
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            className="sr-only"
            aria-label="Import a definition file"
            tabIndex={-1}
            onChange={(event) => {
              void importFile(event.target.files?.[0]);
              // The same file can then be picked again after an edit.
              event.target.value = '';
            }}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fileInput.current?.click()}
          >
            <UploadIcon aria-hidden />
            Import JSON file
          </Button>
        </div>

        {register.isError ? (
          <Alert variant="destructive" data-testid="register-error">
            <AlertTitle>The marketplace refused the definition</AlertTitle>
            <AlertDescription>{describeError(register.error)}</AlertDescription>
          </Alert>
        ) : null}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onDone} disabled={register.isPending}>
            Cancel
          </Button>
          <Button type="submit" disabled={register.isPending}>
            {register.isPending ? 'Submitting...' : 'Submit for review'}
          </Button>
        </DialogFooter>
      </form>
    </>
  );
}
