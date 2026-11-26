import { afterEach, describe, expect, it, vi } from 'vitest';

import { TourRunner, type StepView, type TourHighlighter, type TourStep } from './tour-runner';
import { waitForElement } from './wait-for-element';

function recordingHighlighter() {
  const shown: StepView[] = [];
  const waiting: number[] = [];
  const destroy = vi.fn();
  const highlighter: TourHighlighter = {
    show: (view) => shown.push(view),
    showWaiting: (view) => waiting.push(view.index),
    destroy,
  };
  return { highlighter, shown, waiting, destroy };
}

function addElement(id: string) {
  const element = document.createElement('div');
  element.dataset.tour = id;
  document.body.append(element);
  return element;
}

afterEach(() => {
  document.body.replaceChildren();
});

describe('waitForElement', () => {
  it('resolves with an element that appears later', async () => {
    const pending = waitForElement('[data-tour="late"]', { timeoutMs: 1000 });
    setTimeout(() => addElement('late'), 10);
    expect(await pending).toHaveAttribute('data-tour', 'late');
  });

  it('resolves null after the timeout and when aborted', async () => {
    expect(await waitForElement('[data-tour="never"]', { timeoutMs: 20 })).toBeNull();

    const controller = new AbortController();
    const pending = waitForElement('[data-tour="never"]', {
      timeoutMs: 10_000,
      signal: controller.signal,
    });
    controller.abort();
    expect(await pending).toBeNull();
  });
});

describe('TourRunner', () => {
  const steps: TourStep[] = [
    { title: 'Welcome', description: 'Hello' },
    { path: '/reports', selector: '[data-tour="board"]', title: 'Board', description: '' },
    { selector: '[data-tour="missing"]', title: 'Missing', description: '' },
    { selector: '[data-tour="palette"]', title: 'Palette', description: '' },
  ];

  function setup() {
    const recorder = recordingHighlighter();
    let path = '/';
    const navigate = vi.fn((to: string) => {
      path = to;
      // The page renders its content a moment after navigation, like a real route.
      if (to === '/reports') setTimeout(() => addElement('board'), 10);
    });
    const onEnd = vi.fn();
    const runner = new TourRunner({
      steps,
      highlighter: recorder.highlighter,
      navigate,
      currentPath: () => path,
      timeoutMs: 50,
      onEnd,
    });
    return { ...recorder, runner, navigate, onEnd };
  }

  it('shows a step without a selector in the middle of the screen', async () => {
    const { runner, shown } = setup();
    await runner.start();
    expect(shown).toEqual([expect.objectContaining({ index: 0, element: null, isFirst: true })]);
  });

  it('opens the step page and waits for its target', async () => {
    const { runner, shown, waiting, navigate } = setup();
    await runner.start(1);

    expect(navigate).toHaveBeenCalledWith('/reports');
    expect(waiting).toContain(1);
    expect(shown.at(-1)).toMatchObject({ index: 1, total: 4 });
    expect(shown.at(-1)?.element).toHaveAttribute('data-tour', 'board');
  });

  it('does not navigate when the step page is already open', async () => {
    const { runner, navigate } = setup();
    addElement('palette');
    await runner.start(3);
    expect(navigate).not.toHaveBeenCalled();
  });

  it('skips a step whose target never appears, in the direction the user is going', async () => {
    const { runner, shown } = setup();
    addElement('board');
    addElement('palette');

    await runner.start(1);
    await runner.next(1);
    expect(shown.at(-1)).toMatchObject({ index: 3, isLast: true });

    await runner.previous(3);
    expect(shown.at(-1)).toMatchObject({ index: 1 });
  });

  it('ends after the last step and when stopped', async () => {
    const { runner, destroy, onEnd } = setup();
    addElement('palette');
    await runner.start(3);
    await runner.next(3);
    expect(destroy).toHaveBeenCalledTimes(1);
    expect(onEnd).toHaveBeenCalledTimes(1);
    expect(runner.isActive).toBe(false);
  });

  it('stops waiting when the tour is closed', async () => {
    const { runner, shown } = setup();
    const pending = runner.start(2);
    runner.stop();
    await pending;
    addElement('missing');
    expect(shown).toEqual([]);
  });
});
