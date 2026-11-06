import { createMockSystemManager } from './app.ts';

function numberFromEnv(name: string): number | undefined {
  const value = process.env[name];
  return value ? Number(value) : undefined;
}

const port = Number(process.env.PORT ?? 10000);
const server = createMockSystemManager({
  accessTokenTtlSeconds: numberFromEnv('ACCESS_TOKEN_TTL_SECONDS'),
  instanceStartupMs: numberFromEnv('INSTANCE_STARTUP_MS'),
  placementDemo: process.env.PLACEMENT_DEMO === 'true',
});

server.listen(port, () => {
  console.log(`mock-system-manager listening on :${port} (API under /api)`);
});

// Docker sends SIGTERM on stop; without a handler Node would wait for the kill timeout.
for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
