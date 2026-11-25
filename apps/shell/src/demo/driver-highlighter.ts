import 'driver.js/dist/driver.css';
import './tour.css';

import { driver, type DriveStep, type Popover } from 'driver.js';

import type { StepView, TourHighlighter } from './tour-runner';

export interface DriverHighlighterHandlers {
  onNext: (index: number) => void;
  onPrevious: (index: number) => void;
  onClose: () => void;
}

/**
 * Shows the runner's steps with driver.js. driver.js only draws single highlights here
 * (`highlight()`), its own step list stays unused: steps span pages, and only the runner knows
 * when a target has appeared or has to be skipped.
 */
export function createDriverHighlighter(handlers: DriverHighlighterHandlers): TourHighlighter {
  const tour = driver({
    animate: !window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    overlayColor: 'black',
    overlayOpacity: 0.5,
    stagePadding: 6,
    stageRadius: 10,
    popoverClass: 'oak-tour',
    // Escape and a click on the overlay end the tour through the runner, so it stops waiting for
    // the next target too. driver.js leaves destroying to this hook once it is set.
    onDestroyStarted: () => handlers.onClose(),
    // Covers the ways driver.js ends on its own without that hook (no active step yet).
    onDestroyed: () => handlers.onClose(),
  });

  const popover = (view: Omit<StepView, 'element'>, waiting: boolean): Popover => ({
    title: view.step.title,
    description: waiting ? 'Loading...' : view.step.description,
    side: view.step.side,
    showButtons: ['previous', 'next', 'close'],
    disableButtons: [
      ...(view.isFirst || waiting ? ['previous' as const] : []),
      ...(waiting ? ['next' as const] : []),
    ],
    showProgress: true,
    progressText: `${view.index + 1} of ${view.total}`,
    prevBtnText: 'Back',
    nextBtnText: view.isLast ? 'Done' : 'Next',
    closeBtnLabel: 'End tour',
    onNextClick: () => handlers.onNext(view.index),
    onPrevClick: () => handlers.onPrevious(view.index),
    onCloseClick: () => handlers.onClose(),
  });

  const highlight = (step: DriveStep) => tour.highlight(step);

  return {
    show: (view) =>
      highlight({ element: view.element ?? undefined, popover: popover(view, false) }),
    showWaiting: (view) => highlight({ popover: popover(view, true) }),
    destroy: () => {
      if (tour.isActive()) tour.destroy();
    },
  };
}
