import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Button, Result } from 'antd';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  private handleReset = () => {
    localStorage.removeItem('netcraft-storage');
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center w-screen h-screen bg-slate-950 text-slate-100">
          <Result
            status="500"
            title="Something went wrong"
            subTitle={
              <div className="text-slate-400">
                <p className="mb-4">The application encountered a critical error.</p>
                <p className="text-xs opacity-50 mb-6 font-mono">{this.state.error?.message}</p>
              </div>
            }
            extra={
              <Button type="primary" danger onClick={this.handleReset}>
                Reset Application (Clear Data)
              </Button>
            }
          />
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
