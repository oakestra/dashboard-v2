import { afterEach, describe, expect, it } from 'vitest';

import { DEFAULT_MAP_STYLES, getMapStyles, setMapStyles } from './map-styles';

const KEY = Symbol.for('oakestra.ui.mapStyles');

afterEach(() => {
  delete (globalThis as Record<symbol, unknown>)[KEY];
});

describe('map styles', () => {
  it('falls back to the default styles', () => {
    expect(getMapStyles()).toBe(DEFAULT_MAP_STYLES);
  });

  it('is shared through a global symbol, so separately bundled copies see the same value', () => {
    const styles = { light: 'https://tiles.example/l.json', dark: 'https://tiles.example/d.json' };
    setMapStyles(styles);
    expect((globalThis as Record<symbol, unknown>)[KEY]).toBe(styles);
    expect(getMapStyles()).toBe(styles);
  });
});
