import { Component, type ErrorInfo, type ReactNode } from "react";
import { crashNotice } from "../domain/board-notice";

type State = { error: Error | null };

/** Keeps one render crash from blanking the whole page. Retry remounts children. */
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
      const notice = crashNotice(this.state.error.message);
      return (
        <div className="app">
          <div className={`banner ${notice.kind === "err" ? "err" : ""}`}>
            {notice.text}
            <button className="ghost" type="button" onClick={() => this.setState({ error: null })}>
              {notice.action}
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
