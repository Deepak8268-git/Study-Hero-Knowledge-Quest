import React from 'react';
import { PresenceRecord } from '../context/PresenceContext';

const PresenceBadge: React.FC<{ presence?: PresenceRecord; compact?: boolean }> = ({ presence, compact = false }) => {
  const status = presence?.status || 'offline';
  const color = status === 'online' ? 'bg-success' : status === 'reconnecting' ? 'bg-warning' : 'bg-gray-400';
  const label = status === 'online' ? 'Online' : status === 'reconnecting' ? 'Reconnecting' : 'Offline';
  const lastSeen = presence?.lastSeen ? `Last seen ${new Date(presence.lastSeen).toLocaleString()}` : 'Last seen unavailable';

  return (
    <span className="inline-flex items-center gap-2 text-xs text-gray-500" title={lastSeen}>
      <span className={`h-2.5 w-2.5 rounded-full ${color}`}></span>
      {!compact && <span>{label}</span>}
    </span>
  );
};

export default PresenceBadge;