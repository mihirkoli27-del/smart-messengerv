import { io, Socket } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';

let socket: Socket | null = null;

export const getSocket = (): Socket => {
  if (!socket) {
    socket = io(SOCKET_URL, {
      autoConnect: false,
      withCredentials: true,
    });
  }
  return socket;
};

export const connectSocket = (userId: string) => {
  const s = getSocket();
  if (!s.connected) {
    s.connect();
    s.emit('register_user', userId);
    console.log(`Socket connecting and registering user: ${userId}`);
  }
};

export const disconnectSocket = () => {
  if (socket) {
    if (socket.connected) {
      socket.disconnect();
    }
    socket = null;
    console.log('Socket disconnected and client reference cleared.');
  }
};
