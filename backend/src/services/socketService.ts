import { Server, Socket } from 'socket.io';
import { Server as HttpServer } from 'http';
import jwt from 'jsonwebtoken';
import env from '../config/env';
import logger from '../config/logger';

let io: Server;

export const initSocket = (server: HttpServer) => {
  io = new Server(server, {
    cors: {
      origin: env.corsAllowedOrigins.length > 0 ? env.corsAllowedOrigins : '*',
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  // Middleware for Authentication
  io.use((socket: Socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;

    if (!token) {
      return next(new Error('Authentication error: No token provided'));
    }

    try {
      const decoded = jwt.verify(token, env.jwtSecret) as { id: string };
      (socket as any).userId = decoded.id;
      next();
    } catch (err) {
      next(new Error('Authentication error: Invalid token'));
    }
  });

  io.on('connection', (socket: Socket) => {
    const userId = (socket as any).userId;
    logger.info('socket_connected', { socketId: socket.id, userId });

    // Join user to a private room
    socket.join(`user:${userId}`);

    socket.on('disconnect', () => {
      logger.info('socket_disconnected', { socketId: socket.id, userId });
    });
  });

  return io;
};

export const getIo = () => {
  if (!io) {
    throw new Error('Socket.io not initialized');
  }
  return io;
};

export const emitToUser = (userId: string, event: string, data: any) => {
  if (!io) return;
  io.to(`user:${userId}`).emit(event, data);
};

export const emitToUsers = (userIds: string[], event: string, data: any) => {
  if (!io) return;
  const uniqueIds = Array.from(new Set(userIds.filter(Boolean)));
  uniqueIds.forEach((userId) => {
    io.to(`user:${userId}`).emit(event, data);
  });
};
