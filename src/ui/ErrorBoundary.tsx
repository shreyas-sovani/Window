import { Component, type ErrorInfo, type ReactNode } from "react";

type State = { error: Error | null };

/** Keeps one render crash from blanking the whole terminal. */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Window render error", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="app">
          <div className="banner err">
            The board hit an unexpected error: {this.state.error.message}. Refresh to reconnect — your on-chain
            positions are safe.
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
