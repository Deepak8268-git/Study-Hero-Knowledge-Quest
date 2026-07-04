import React from 'react';
import { useConnectivity } from '../context/ConnectivityContext';

const ConnectionIndicator: React.FC = () => {
  const { browserOnline, backendStatus, socketStatus } = useConnectivity();
  const healthy = browserOnline && backendStatus === 'online' && (socketStatus === 'connected' || socketStatus === 'idle');
  const reconnecting = browserOnline && (backendStatus === 'checking' || socketStatus === 'reconnecting');
  const label = healthy ? 'Online' : reconnecting ? 'Reconnecting' : 'Offline';
  const color = healthy ? 'bg-success' : reconnecting ? 'bg-warning' : 'bg-danger';

  return (
    <span className="inline-flex items-center gap-2 text-xs font-medium" title={`Browser: ${browserOnline ? 'online' : 'offline'} | Backend: ${backendStatus} | Live: ${socketStatus}`}>
      <span className={`h-2.5 w-2.5 rounded-full ${color}`}></span>
      {label}
    </span>
  );
};

export default ConnectionIndicator;