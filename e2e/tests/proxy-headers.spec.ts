import { expect, test } from './fixtures.ts';

// The addons-manager answers JSON as text/html with unescaped user input. Opened as a page on the
// dashboard origin that would run script next to the refresh token in localStorage.
test.describe('backend proxies', () => {
  for (const path of ['/addons-api/', '/marketplace-api/', '/ui-addons']) {
    test(`${path} cannot be rendered as a page`, async ({ request }) => {
      const response = await request.get(path);
      expect(response.ok()).toBe(true);
      const headers = response.headers();
      expect(headers['content-security-policy']).toBe("default-src 'none'; sandbox");
      expect(headers['x-content-type-options']).toBe('nosniff');
      expect(headers['content-disposition']).toBe('attachment');
      expect(headers['cache-control']).toContain('no-store');
    });
  }
});
