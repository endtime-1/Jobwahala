import React, { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './AuthContext';
import { dispatchRealtimeEvent } from '../lib/realtime';

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
}

const SocketContext = createContext<SocketContextType | undefined>(undefined);

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};

interface SocketProviderProps {
  children: ReactNode;
}

export const SocketProvider: React.FC<SocketProviderProps> = ({ children }) => {
  const { user } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!user) {
      if (socket) {
        socket.disconnect();
        setSocket(null);
        setIsConnected(false);
      }
      return;
    }

    const token = localStorage.getItem('jobwahala_token');
    const rawApiUrl = import.meta.env.VITE_API_URL?.trim();
    const BASE_URL = rawApiUrl ? rawApiUrl.replace(/\/$/, '') : '';
    
    const socketUrl = BASE_URL.replace(/\/api$/, '') || window.location.origin;

    const newSocket = io(socketUrl, {
      auth: { token },
      transports: ['websocket'],
    });

    newSocket.on('connect', () => {
      setIsConnected(true);
      dispatchRealtimeEvent('connected', {});
    });

    newSocket.on('disconnect', () => {
      setIsConnected(false);
    });

    // Listen for all refresh events and dispatch them to the centralized system
    const events = [
      'notifications.refresh',
      'messages.refresh',
      'proposals.refresh',
      'agreements.refresh'
    ];

    events.forEach(event => {
      newSocket.on(event, (data) => {
        dispatchRealtimeEvent(event, data);
      });
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, [user]);

  return (
    <SocketContext.Provider value={{ socket, isConnected }}>
      {children}
    </SocketContext.Provider>
  );
};
