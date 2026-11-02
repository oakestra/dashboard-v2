import { describe, expect, it } from 'vitest';

import { createOakestraClient } from '../client.ts';
import type { Organization } from '../models/organization.ts';
import { createOrganizationEndpoints } from './organizations.ts';

function setup() {
  const seen: { method: string; url: string; body: unknown }[] = [];
  const client = createOakestraClient({
    baseUrl: 'http://api.test/api',
    fetch: async (request) => {
      const text = await request.text();
      seen.push({
        method: request.method,
        url: request.url,
        body: text ? JSON.parse(text) : undefined,
      });
      return new Response(JSON.stringify({ message: 'ok' }), {
        headers: { 'Content-Type': 'application/json' },
      });
    },
  });
  return { seen, organizations: createOrganizationEndpoints(client) };
}

describe('organization endpoints', () => {
  it('sends name and members, trimmed to user_id and roles, on update', async () => {
    const { seen, organizations } = setup();
    const fetched: Organization = {
      _id: 'o1',
      name: 'edge-lab',
      member: [{ user_id: 'u1', roles: ['Admin'], joined: '01/01/2026' }],
    };
    await organizations.update(fetched._id, { name: 'campus', member: fetched.member });
    expect(seen).toEqual([
      {
        method: 'PUT',
        url: 'http://api.test/api/organization/o1',
        body: { name: 'campus', member: [{ user_id: 'u1', roles: ['Admin'] }] },
      },
    ]);
  });
});
