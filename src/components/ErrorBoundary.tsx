import { Component, type ReactNode } from 'react';

/** Shows a message instead of a blank page if a screen crashes. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="card mx-auto max-w-lg">
        <div className="text-lg font-bold">😵 Có lỗi xảy ra</div>
        <p className="mt-1 text-sm text-muted">{this.state.error.message}</p>
        <button className="btn mt-3" onClick={() => location.reload()}>
          Tải lại trang
        </button>
      </div>
    );
  }
}
