import React from 'react';
import { useConnectivity } from '../context/ConnectivityContext';

const ConnectionStatusBanner: React.FC = () => {
  const { browserOnline, backendStatus, socketStatus, refreshConnectivity } = useConnectivity();

  if (browserOnline && backendStatus === 'online' && (socketStatus === 'connected' || socketStatus === 'idle')) {
    return null;
  }

  const message = !browserOnline
    ? 'You are offline. Changes that require the server will resume when your connection returns.'
    : backendStatus === 'offline'
      ? 'Study Hero is having trouble reaching the backend. Retrying automatically.'
      : socketStatus === 'reconnecting'
        ? 'Live updates are reconnecting.'
        : socketStatus === 'disconnected'
          ? 'Live updates are temporarily unavailable.'
          : 'Checking service availability.';

  return (
    <div className="fixed top-0 left-0 right-0 z-[60] bg-warning text-primary shadow-md" role="status" aria-live="polite">
      <div className="container mx-auto px-4 py-2 flex items-center justify-between gap-3 text-sm">
        <span className="flex items-center gap-2">
          <i className="ri-wifi-off-line"></i>
          {message}
        </span>
        <button type="button" onClick={refreshConnectivity} className="font-semibold underline focus:outline-none focus:ring-2 focus:ring-primary rounded-sm">
          Retry
        </button>
      </div>
    </div>
  );
};

export default ConnectionStatusBanner;