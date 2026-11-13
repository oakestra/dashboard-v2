import { describe, expect, it } from 'vitest';

import { installOutcome } from './use-install-outcome-toasts';

describe('installOutcome', () => {
  it('announces how an install ended', () => {
    expect(installOutcome('installing', 'active')).toBe('active');
    expect(installOutcome('installing', 'failed')).toBe('failed');
    expect(installOutcome('installing', 'partially_active')).toBe('partially_active');
  });

  it('announces how an update ended', () => {
    expect(installOutcome('updating', 'active')).toBe('active');
    expect(installOutcome('updating', 'failed')).toBe('failed');
  });

  it('announces a crash the monitor finds after the install looked fine', () => {
    expect(installOutcome('active', 'failed')).toBe('failed');
    expect(installOutcome('active', 'partially_active')).toBe('partially_active');
  });

  it('stays quiet for everything else', () => {
    expect(installOutcome(undefined, 'failed')).toBeNull();
    expect(installOutcome('active', 'active')).toBeNull();
    expect(installOutcome('installing', 'disabling')).toBeNull();
    expect(installOutcome('disabling', 'disabled')).toBeNull();
    expect(installOutcome('failed', 'active')).toBeNull();
  });
});
