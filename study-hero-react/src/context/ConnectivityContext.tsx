import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { API_BASE_URL, getAuthToken } from '../services/api';
import { connectSocket, getSocket } from '../services/socket';

type BackendStatus = 'checking' | 'online' | 'offline';
type SocketStatus = 'idle' | 'connected' | 'reconnecting' | 'disconnected';

interface ConnectivityContextValue {
  browserOnline: boolean;
  backendStatus: BackendStatus;
  socketStatus: SocketStatus;
  lastBackendCheck?: string;
  refreshConnectivity: () => Promise<void>;
}

const ConnectivityContext = createContext<ConnectivityContextValue | undefined>(undefined);

export const ConnectivityProvider: React.FC<{ children: React.ReactNode; authKey?: string }> = ({ children, authKey }) => {
  const [browserOnline, setBrowserOnline] = useState(() => navigator.onLine);
  const [backendStatus, setBackendStatus] = useState<BackendStatus>('checking');
  const [socketStatus, setSocketStatus] = useState<SocketStatus>('idle');
  const [lastBackendCheck, setLastBackendCheck] = useState<string>();

  const refreshConnectivity = useCallback(async () => {
    if (!API_BASE_URL || !navigator.onLine) {
      setBackendStatus('offline');
      setLastBackendCheck(new Date().toISOString());
      return;
    }

    setBackendStatus('checking');
    try {
      const response = await fetch(`${API_BASE_URL}/api/health`, { credentials: 'include' });
      setBackendStatus(response.ok ? 'online' : 'offline');
    } catch (error) {
      setBackendStatus('offline');
    } finally {
      setLastBackendCheck(new Date().toISOString());
    }
  }, []);

  useEffect(() => {
    const handleOnline = () => {
      setBrowserOnline(true);
      refreshConnectivity();
      window.dispatchEvent(new CustomEvent('studyhero:network-recovered'));
    };
    const handleOffline = () => {
      setBrowserOnline(false);
      setBackendStatus('offline');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    refreshConnectivity();
    const timer = window.setInterval(refreshConnectivity, 30000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.clearInterval(timer);
    };
  }, [refreshConnectivity]);

  useEffect(() => {
    const token = getAuthToken();
    const socket = token ? connectSocket(token) : getSocket();
    if (!socket) {
      setSocketStatus(token ? 'disconnected' : 'idle');
      return;
    }

    const updateConnected = () => {
      setSocketStatus('connected');
      window.dispatchEvent(new CustomEvent('studyhero:dashboard-refresh'));
    };
    const updateDisconnected = () => setSocketStatus('disconnected');
    const updateReconnecting = () => setSocketStatus('reconnecting');

    if (socket.connected) updateConnected();
    socket.on('connect', updateConnected);
    socket.io.on('reconnect_attempt', updateReconnecting);
    socket.io.on('reconnect', updateConnected);
    socket.on('disconnect', updateDisconnected);
    socket.on('connect_error', updateDisconnected);

    return () => {
      socket.off('connect', updateConnected);
      socket.io.off('reconnect_attempt', updateReconnecting);
      socket.io.off('reconnect', updateConnected);
      socket.off('disconnect', updateDisconnected);
      socket.off('connect_error', updateDisconnected);
    };
  }, [authKey]);

  const value = useMemo(() => ({ browserOnline, backendStatus, socketStatus, lastBackendCheck, refreshConnectivity }), [browserOnline, backendStatus, socketStatus, lastBackendCheck, refreshConnectivity]);
  return <ConnectivityContext.Provider value={value}>{children}</ConnectivityContext.Provider>;
};

export const useConnectivity = () => {
  const context = useContext(ConnectivityContext);
  if (!context) throw new Error('useConnectivity must be used within ConnectivityProvider');
  return context;
};