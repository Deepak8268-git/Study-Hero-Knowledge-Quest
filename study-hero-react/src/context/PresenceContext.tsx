import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { getAuthToken } from '../services/api';
import { connectSocket } from '../services/socket';

export type PresenceStatus = 'online' | 'offline' | 'reconnecting';

export interface PresenceRecord {
  userId: number;
  status: PresenceStatus;
  lastSeen: string;
}

interface PresenceContextValue {
  presence: Record<number, PresenceRecord>;
  getPresence: (userId?: number | string | null) => PresenceRecord | undefined;
}

const PresenceContext = createContext<PresenceContextValue | undefined>(undefined);

export const PresenceProvider: React.FC<{ children: React.ReactNode; authKey?: string }> = ({ children, authKey }) => {
  const [presence, setPresence] = useState<Record<number, PresenceRecord>>({});

  useEffect(() => {
    const token = getAuthToken();
    const socket = token ? connectSocket(token) : null;
    if (!socket) return;

    const applyPresence = (record: PresenceRecord) => {
      setPresence((current) => ({ ...current, [record.userId]: record }));
    };

    const syncPresence = (records: PresenceRecord[]) => {
      const next: Record<number, PresenceRecord> = {};
      records.forEach((record) => { next[record.userId] = record; });
      setPresence(next);
    };

    socket.on('presence:update', applyPresence);
    socket.on('presence:sync', syncPresence);
    socket.on('reconnect_attempt', () => {
      setPresence((current) => {
        const next = { ...current };
        Object.keys(next).forEach((id) => { next[Number(id)] = { ...next[Number(id)], status: 'reconnecting' }; });
        return next;
      });
    });

    return () => {
      socket.off('presence:update', applyPresence);
      socket.off('presence:sync', syncPresence);
      socket.off('reconnect_attempt');
    };
  }, [authKey]);

  const value = useMemo(() => ({
    presence,
    getPresence: (userId?: number | string | null) => userId ? presence[Number(userId)] : undefined
  }), [presence]);

  return <PresenceContext.Provider value={value}>{children}</PresenceContext.Provider>;
};

export const usePresence = () => {
  const context = useContext(PresenceContext);
  if (!context) throw new Error('usePresence must be used within PresenceProvider');
  return context;
};