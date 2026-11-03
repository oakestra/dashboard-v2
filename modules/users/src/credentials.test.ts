import { describe, expect, it } from 'vitest';

import { formatCredentials, generatePassword } from './credentials';

describe('generatePassword', () => {
  it('has the requested length, all character classes and no look-alikes', () => {
    for (let i = 0; i < 50; i++) {
      const password = generatePassword(16);
      expect(password).toHaveLength(16);
      expect(password).toMatch(/[A-Z]/);
      expect(password).toMatch(/[a-z]/);
      expect(password).toMatch(/\d/);
      expect(password).not.toMatch(/[0O1lI]/);
    }
  });
});

describe('formatCredentials', () => {
  it('lists the login data and asks for a password change', () => {
    const text = formatCredentials({
      username: 'erin',
      password: 'pw',
      email: 'e@example.com',
      dashboardUrl: 'https://dash',
    });
    expect(text).toContain('Dashboard: https://dash');
    expect(text).toContain('Username: erin');
    expect(text).toContain('Please change the password');
  });
});
