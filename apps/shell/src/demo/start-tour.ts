import { createDriverHighlighter } from './driver-highlighter';
import { DEMO_TOUR_STEPS } from './tour-steps';
import { TourRunner } from './tour-runner';

export interface StartTourOptions {
  navigate: (path: string) => void | Promise<void>;
  currentPath: () => string;
  onEnd?: () => void;
}

/** Loaded on demand by the demo bar, so driver.js is fetched only when someone takes the tour. */
export function startDemoTour(options: StartTourOptions): TourRunner {
  const runner: TourRunner = new TourRunner({
    ...options,
    steps: DEMO_TOUR_STEPS,
    // The buttons only fire after start(), when `runner` is assigned.
    highlighter: createDriverHighlighter({
      onNext: (index) => void runner.next(index),
      onPrevious: (index) => void runner.previous(index),
      onClose: () => runner.stop(),
    }),
  });
  void runner.start();
  return runner;
}
