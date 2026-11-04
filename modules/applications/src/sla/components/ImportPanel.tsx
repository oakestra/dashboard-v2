import { Alert, AlertDescription, AlertTitle, Button, cn } from '@oakestra/ui';
import { FileUp } from 'lucide-react';
import { useRef, useState, type DragEvent } from 'react';

function readText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = () => reject(reader.error ?? new Error('Could not read the file.'));
    reader.readAsText(file);
  });
}

/** File input plus drop target for an SLA JSON file. Reports the text; parsing is the caller's. */
export function ImportPanel({
  onText,
  error,
  warnings,
}: {
  onText: (text: string, fileName: string) => void;
  error: string | null;
  warnings: string[];
}) {
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  async function load(file: File | undefined) {
    if (!file) return;
    try {
      onText(await readText(file), file.name);
    } catch {
      onText('', file.name);
    }
    // Lets the same file be picked again after it was edited.
    if (input.current) input.current.value = '';
  }

  function onDrop(event: DragEvent) {
    event.preventDefault();
    setDragging(false);
    void load(event.dataTransfer.files[0]);
  }

  return (
    <div className="space-y-3">
      <div
        data-testid="sla-dropzone"
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={cn(
          'flex flex-wrap items-center justify-between gap-3 rounded-lg border border-dashed px-4 py-2.5',
          dragging && 'border-primary bg-primary/5',
        )}
      >
        <p className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">Have an SLA file?</span> Drop it here to
          fill in the form. SLA v2 and the older <code>microservices</code> export work.
        </p>
        <Button type="button" variant="outline" size="sm" onClick={() => input.current?.click()}>
          <FileUp /> Import SLA JSON
        </Button>
        <input
          ref={input}
          type="file"
          accept=".json,application/json"
          aria-label="SLA JSON file"
          className="sr-only"
          tabIndex={-1}
          onChange={(event) => void load(event.target.files?.[0])}
        />
      </div>
      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Could not import the file</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      {warnings.map((warning) => (
        <Alert key={warning} variant="warning">
          <AlertDescription>{warning}</AlertDescription>
        </Alert>
      ))}
    </div>
  );
}
