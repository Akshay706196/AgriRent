import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertOctagon, RotateCcw } from 'lucide-react';
import { Button } from './Button';

export interface ErrorBoundaryProps {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[AgriRent Frontend ErrorBoundary]:', error, errorInfo);
  }

  public handleReload = () => {
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[60vh] flex items-center justify-center p-6">
          <div className="bg-white rounded-3xl border border-rose-100 shadow-elevated p-8 max-w-md w-full text-center">
            <div className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-4">
              <AlertOctagon className="w-7 h-7" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 font-display">Something went wrong</h2>
            <p className="text-xs text-slate-600 mt-2 leading-relaxed">
              An unexpected user interface exception occurred. The error details have been logged.
            </p>
            {this.state.error?.message && (
              <div className="mt-4 p-3 bg-slate-50 rounded-xl text-left font-mono text-[11px] text-slate-600 break-words">
                {this.state.error.message}
              </div>
            )}
            <div className="mt-6 flex justify-center">
              <Button variant="primary" onClick={this.handleReload}>
                <RotateCcw className="w-4 h-4 mr-2" />
                Reload Application
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
