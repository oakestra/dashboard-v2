import { mockAddonsManagerUrl, mockApiUrl } from './env.ts';

/** Fails fast with a useful message instead of 30s timeouts in every test. */
export default async function globalSetup(): Promise<void> {
  const baseUrl = process.env.E2E_BASE_URL ?? 'http://localhost:8080';
  for (const url of [
    `${baseUrl}/config.json`,
    `${mockAddonsManagerUrl}/healthz`,
    `${mockApiUrl}/healthz`,
  ]) {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
    } catch (error) {
      throw new Error(
        `${url} is not reachable (${String(error)}). Start the stack first: ` +
          'docker compose -f compose.dev.yml up --build -d',
      );
    }
  }
}
