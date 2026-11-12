import { createMockAddonsManager, seedFromEnv } from './app.ts';

const port = Number(process.env.PORT ?? 11101);
const server = createMockAddonsManager({
  seed: seedFromEnv(process.env.MOCK_ADDONS),
  installDelayMs: process.env.INSTALL_DELAY_MS ? Number(process.env.INSTALL_DELAY_MS) : undefined,
  monitorDelayMs: process.env.MONITOR_DELAY_MS ? Number(process.env.MONITOR_DELAY_MS) : undefined,
});

server.listen(port, () => {
  console.log(`mock-addons-manager listening on :${port}`);
});

// Docker sends SIGTERM on stop; without a handler Node would wait for the kill timeout.
for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
