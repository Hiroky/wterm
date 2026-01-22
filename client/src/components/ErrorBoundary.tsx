import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-screen flex-col items-center justify-center bg-gray-900 text-white">
          <div className="max-w-lg text-center">
            <div className="mb-6 text-6xl">!</div>
            <h1 className="mb-4 text-2xl font-bold text-red-400">
              Something went wrong
            </h1>
            <p className="mb-6 text-gray-400">
              An unexpected error occurred. You can try to recover or reload the
              page.
            </p>

            {this.state.error && (
              <div className="mb-6 rounded bg-gray-800 p-4 text-left">
                <p className="mb-2 text-sm font-semibold text-red-300">
                  Error Details:
                </p>
                <pre className="overflow-x-auto text-xs text-gray-400">
                  {this.state.error.message}
                </pre>
                {this.state.errorInfo && (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-xs text-gray-500 hover:text-gray-300">
                      Stack trace
                    </summary>
                    <pre className="mt-2 max-h-40 overflow-auto text-xs text-gray-500">
                      {this.state.errorInfo.componentStack}
                    </pre>
                  </details>
                )}
              </div>
            )}

            <div className="flex justify-center gap-4">
              <button
                onClick={this.handleRetry}
                className="rounded bg-blue-600 px-6 py-2 font-medium hover:bg-blue-700"
              >
                Try Again
              </button>
              <button
                onClick={this.handleReload}
                className="rounded border border-gray-600 px-6 py-2 font-medium hover:bg-gray-800"
              >
                Reload Page
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
