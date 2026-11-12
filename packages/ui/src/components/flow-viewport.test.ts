import { describe, expect, it } from 'vitest';

import { fitViewport, MIN_READABLE_ZOOM } from './flow-viewport';

const bounds = { minHeight: 160, maxHeight: 600 };

describe('fitViewport', () => {
  it('centers a graph that fits and sizes the frame to it', () => {
    // 552 x 252 with the default padding of 24.
    const fit = fitViewport({ width: 504, height: 204 }, 1000, bounds);
    expect(fit.zoom).toBe(1);
    expect(fit.height).toBe(252);
    expect(fit.x).toBe((1000 - 504) / 2);
    expect(fit.y).toBe(24);
  });

  it('shrinks a wide graph to the frame width, but not below a readable zoom', () => {
    // Would need 0.5 to fit.
    const fit = fitViewport({ width: 1552, height: 352 }, 800, bounds);
    expect(fit.zoom).toBe(MIN_READABLE_ZOOM);
    expect(fit.height).toBe(Math.round(400 * MIN_READABLE_ZOOM));
  });

  it('keeps a readable zoom on a narrow frame and starts at the first column', () => {
    const fit = fitViewport({ width: 1552, height: 152 }, 390, bounds);
    expect(fit.zoom).toBe(MIN_READABLE_ZOOM);
    // Anchored at the start, not centered off screen.
    expect(fit.x).toBe(24 * MIN_READABLE_ZOOM);
    // A flat graph still gets the minimum height and is centered in it.
    expect(fit.height).toBe(160);
    expect(fit.y).toBe((160 - 152 * MIN_READABLE_ZOOM) / 2);
  });

  it('shrinks a graph that fits at a readable zoom exactly to the frame', () => {
    const fit = fitViewport({ width: 1152, height: 352 }, 960, bounds);
    expect(fit.zoom).toBe(0.8);
    expect(fit.height).toBe(320);
    expect(fit.x).toBeCloseTo(24 * 0.8);
  });

  it('caps the height and anchors a tall graph at the top', () => {
    const fit = fitViewport({ width: 300, height: 2000 }, 1000, bounds);
    expect(fit.height).toBe(600);
    expect(fit.y).toBe(24);
  });

  it('uses zoom 1 before the frame is measured', () => {
    const fit = fitViewport({ width: 300, height: 100 }, 0, bounds);
    expect(fit).toEqual({ x: 24, y: 30, zoom: 1, height: 160 });
  });
});

describe('fitViewport bottomInset', () => {
  it('adds the inset to the frame and keeps the graph above it', () => {
    const fit = fitViewport({ width: 504, height: 204 }, 1000, { ...bounds, bottomInset: 44 });
    expect(fit.height).toBe(252 + 44);
    expect(fit.y).toBe(24);
    expect(fit.y + 204 * fit.zoom).toBeLessThanOrEqual(fit.height - 44);
  });
});
