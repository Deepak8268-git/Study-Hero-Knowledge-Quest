import React from 'react';

interface ErrorBoundaryState { hasError: boolean; message: string; }

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, message: '' };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, message: error.message };
  }

  componentDidCatch(error: Error) {
    console.error('Application error boundary:', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
          <div className="bg-white rounded-xl shadow-md max-w-md p-6 text-center">
            <i className="ri-error-warning-line text-4xl text-danger"></i>
            <h1 className="text-xl font-bold text-gray-800 mt-3">Something went wrong</h1>
            <p className="text-sm text-gray-500 mt-2">{this.state.message || 'The application could not render this view.'}</p>
            <button type="button" onClick={() => window.location.reload()} className="mt-5 px-4 py-2 bg-primary text-white rounded-md focus:outline-none focus:ring-2 focus:ring-primary">
              Reload
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;