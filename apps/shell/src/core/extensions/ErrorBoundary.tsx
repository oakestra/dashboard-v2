import { Component, type ErrorInfo, type ReactNode } from 'react';

interface ErrorBoundaryProps {
  /** `reset` renders the children again. Whatever still throws lands back in the fallback. */
  fallback: (error: Error, reset: () => void) => ReactNode;
  onError?: (error: Error, info: ErrorInfo) => void;
  /** A change clears a caught error, for errors that belong to one state of the app (a URL). */
  resetKey?: unknown;
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  override state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    return { error: error instanceof Error ? error : new Error(String(error)) };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    this.props.onError?.(error, info);
  }

  override componentDidUpdate(
    previousProps: ErrorBoundaryProps,
    previousState: ErrorBoundaryState,
  ): void {
    // Only an error that was already showing: when the new key is what made the children throw,
    // clearing it here would render them a second time for nothing.
    if (previousState.error && previousProps.resetKey !== this.props.resetKey) this.reset();
  }

  private readonly reset = (): void => {
    this.setState({ error: null });
  };

  override render(): ReactNode {
    return this.state.error
      ? this.props.fallback(this.state.error, this.reset)
      : this.props.children;
  }
}
