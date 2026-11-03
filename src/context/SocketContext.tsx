import React, { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Socket } from 'socket.io-client';
import { useAuth } from './AuthContext';
import { dispatchRealtimeEvent } from '../lib/realtime';

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
}

const SocketContext = createContext<SocketContextType | undefined>(undefined);

// eslint-disable-next-line react-refresh/only-export-components -- hook is co-located with its provider; tests mock this module path
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
        // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: state reset or fetch kicked off when inputs change
        setSocket(null);
        setIsConnected(false);
      }
      return;
    }

    const token = localStorage.getItem('jobwahala_token');
    const rawApiUrl = import.meta.env.VITE_API_URL?.trim();
    const BASE_URL = rawApiUrl ? rawApiUrl.replace(/\/$/, '') : '';
    
    const socketUrl = BASE_URL.replace(/\/api$/, '') || window.location.origin;

    // The socket library is only needed once someone is signed in, so it stays out of the
    // startup bundle that logged-out visitors download.
    let cancelled = false;
    let activeSocket: Socket | null = null;

    void import('socket.io-client').then(({ io }) => {
      if (cancelled) return;

      const newSocket = io(socketUrl, {
        auth: { token },
        transports: ['websocket'],
      });
      activeSocket = newSocket;

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
    });

    return () => {
      cancelled = true;
      activeSocket?.disconnect();
    };
  }, [user]);

  return (
    <SocketContext.Provider value={{ socket, isConnected }}>
      {children}
    </SocketContext.Provider>
  );
};
