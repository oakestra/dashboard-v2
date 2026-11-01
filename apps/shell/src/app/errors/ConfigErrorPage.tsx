export function ConfigErrorPage({ message }: { message: string }) {
  return (
    <div role="alert" className="mx-auto max-w-2xl space-y-3 p-8">
      <h1 className="text-2xl font-semibold">The dashboard is not configured correctly</h1>
      <p className="text-muted-foreground">
        The runtime configuration (<code>/config.json</code>) could not be loaded. Check the
        container environment variables.
      </p>
      <pre className="bg-muted overflow-auto rounded-md p-4 text-sm whitespace-pre-wrap">
        {message}
      </pre>
    </div>
  );
}
