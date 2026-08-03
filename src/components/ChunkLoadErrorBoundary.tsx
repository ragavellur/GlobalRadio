import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  failed: boolean;
}

export default class ChunkLoadErrorBoundary extends Component<Props, State> {
  state: State = { failed: false };
  private timer: number | undefined;

  static getDerivedStateFromError(error: unknown): State {
    return { failed: (error as Error)?.name === 'ChunkLoadError' };
  }

  componentDidCatch(error: unknown) {
    if ((error as Error)?.name !== 'ChunkLoadError') return;
    this.timer = window.setTimeout(() => window.location.reload(), 500);
  }

  componentWillUnmount() {
    if (this.timer !== undefined) window.clearTimeout(this.timer);
  }

  render() {
    if (this.state.failed) {
      return (
        <div
          className="fixed inset-0 z-[60] flex flex-col items-center justify-center gap-3"
          style={{ background: '#0a0a0a' }}
        >
          <div
            className="animate-spin rounded-full"
            style={{
              width: 32,
              height: 32,
              border: '3px solid rgba(255,255,255,0.15)',
              borderTopColor: '#00C864',
            }}
          />
          <p className="text-white/60 text-[13px]">Updating app…</p>
        </div>
      );
    }
    return this.props.children;
  }
}
