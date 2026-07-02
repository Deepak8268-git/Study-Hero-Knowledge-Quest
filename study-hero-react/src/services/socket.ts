import { io, Socket } from 'socket.io-client';

const API_BASE_URL = process.env.REACT_APP_API_URL;
let socket: Socket | null = null;

export const getSocket = () => socket;

export const connectSocket = (token: string): Socket | null => {
  if (!API_BASE_URL || !token) return null;

  if (socket?.connected) return socket;

  if (socket) {
    socket.auth = { token };
    socket.connect();
    return socket;
  }

  socket = io(API_BASE_URL, {
    auth: { token },
    transports: ['websocket', 'polling'],
    withCredentials: true,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000
  });

  return socket;
};

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};