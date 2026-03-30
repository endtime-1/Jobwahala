import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { registerRealtimeClient, writeRealtimeEvent } from '../services/realtime';

export const streamRealtimeEvents = async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;

  if (!userId) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();

  const unregister = registerRealtimeClient(userId, res);
  const keepAlive = setInterval(() => {
    writeRealtimeEvent(res, 'ping', {
      timestamp: new Date().toISOString(),
    });
  }, 25000);

  req.on('close', () => {
    clearInterval(keepAlive);
    unregister();
    res.end();
  });
};
