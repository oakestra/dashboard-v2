import { waitForElement } from './wait-for-element';

export interface TourStep {
  /** App path (without the site's base path) to open first, unless it is already open. */
  path?: string;
  /** What to highlight. Without one the step is a popover in the middle of the screen. */
  selector?: string;
  title: string;
  description: string;
  side?: 'top' | 'right' | 'bottom' | 'left';
}

export interface StepView {
  step: TourStep;
  /** `null` for a step without a selector. */
  element: Element | null;
  index: number;
  total: number;
  isFirst: boolean;
  isLast: boolean;
}

/** Draws the steps. The runner decides which step comes next, the highlighter only shows it. */
export interface TourHighlighter {
  show(view: StepView): void;
  /** Shown while the target of the next step is not there yet (page or addon still loading). */
  showWaiting(view: Omit<StepView, 'element'>): void;
  destroy(): void;
}

export interface TourRunnerOptions {
  steps: readonly TourStep[];
  highlighter: TourHighlighter;
  navigate: (path: string) => void | Promise<void>;
  currentPath: () => string;
  /** How long a step waits for its target before it is skipped. */
  timeoutMs?: number;
  root?: ParentNode & Node;
  onEnd?: () => void;
}

const DEFAULT_TIMEOUT_MS = 8000;

/**
 * Walks through tour steps across pages: opens the step's page, waits for its target and hands
 * it to the highlighter. A target that never appears (a widget whose addon failed to load, the
 * sidebar while it is folded away on a phone) is skipped in the direction the user was going.
 */
export class TourRunner {
  private readonly options: TourRunnerOptions;
  private controller: AbortController | null = null;
  private active = false;

  constructor(options: TourRunnerOptions) {
    this.options = options;
  }

  get isActive(): boolean {
    return this.active;
  }

  start(index = 0): Promise<void> {
    this.active = true;
    return this.go(index, 1);
  }

  next(index: number): Promise<void> {
    return this.go(index + 1, 1);
  }

  previous(index: number): Promise<void> {
    return this.go(index - 1, -1);
  }

  stop(): void {
    if (!this.active) return;
    this.active = false;
    this.controller?.abort();
    this.controller = null;
    this.options.highlighter.destroy();
    this.options.onEnd?.();
  }

  private async go(index: number, direction: 1 | -1): Promise<void> {
    const { steps, highlighter, timeoutMs = DEFAULT_TIMEOUT_MS, root = document } = this.options;
    if (!this.active) return;
    // Every target before this one was missing: start over from the first step that exists.
    if (index < 0) return this.go(0, 1);
    if (index >= steps.length) {
      this.stop();
      return;
    }

    this.controller?.abort();
    const controller = new AbortController();
    this.controller = controller;

    const step = steps[index]!;
    const view = {
      step,
      index,
      total: steps.length,
      isFirst: index === 0,
      isLast: index === steps.length - 1,
    };

    if (step.path !== undefined && this.options.currentPath() !== step.path) {
      if (step.selector) highlighter.showWaiting(view);
      await this.options.navigate(step.path);
      if (controller.signal.aborted) return;
    }

    if (!step.selector) {
      highlighter.show({ ...view, element: null });
      return;
    }

    if (!root.querySelector(step.selector)) highlighter.showWaiting(view);
    const element = await waitForElement(step.selector, {
      timeoutMs,
      signal: controller.signal,
      root,
    });
    if (controller.signal.aborted) return;
    if (element) highlighter.show({ ...view, element });
    else await this.go(index + direction, direction);
  }
}
