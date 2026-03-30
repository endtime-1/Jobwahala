import { Response } from 'express';
import prisma from '../config/prisma';
import { AuthRequest } from '../middleware/auth';
import { deferRealtimeEvent, emitRealtimeEvent } from '../services/realtime';

const notificationInclude = {
  user: {
    select: {
      id: true,
      email: true,
      role: true,
    },
  },
} as const;

export const getMyNotifications = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const limitParam = req.query.limit;
    const rawLimit =
      typeof limitParam === 'string'
        ? limitParam
        : Array.isArray(limitParam) && typeof limitParam[0] === 'string'
          ? limitParam[0]
          : undefined;
    const limit = Number(rawLimit);
    const take = Number.isFinite(limit) && limit > 0 ? Math.min(limit, 50) : 20;

    const [notifications, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where: { userId },
        include: notificationInclude,
        orderBy: [{ read: 'asc' }, { createdAt: 'desc' }],
        take,
      }),
      prisma.notification.count({
        where: {
          userId,
          read: false,
        },
      }),
    ]);

    return res.json({ success: true, notifications, unreadCount });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getMyNotificationSummary = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const unreadCount = await prisma.notification.count({
      where: {
        userId,
        read: false,
      },
    });

    return res.json({ success: true, unreadCount });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const markNotificationRead = async (req: AuthRequest, res: Response) => {
  try {
    const notificationId =
      typeof req.params.id === 'string'
        ? req.params.id
        : Array.isArray(req.params.id)
          ? req.params.id[0]
          : undefined;
    const userId = req.user!.id;

    if (!notificationId) {
      return res.status(400).json({ success: false, message: 'Notification id is required' });
    }

    const notification = await prisma.notification.findUnique({
      where: { id: notificationId },
    });

    if (!notification || notification.userId !== userId) {
      return res.status(404).json({ success: false, message: 'Notification not found' });
    }

    if (notification.read) {
      const unreadCount = await prisma.notification.count({
        where: { userId, read: false },
      });

      deferRealtimeEvent(() => {
        emitRealtimeEvent(userId, 'notifications.refresh', {
          reason: 'read',
          notificationId,
        });
      });

      return res.json({ success: true, notification, unreadCount });
    }

    const [updatedNotification, unreadCount] = await prisma.$transaction([
      prisma.notification.update({
        where: { id: notificationId },
        data: {
          read: true,
          readAt: new Date(),
        },
      }),
      prisma.notification.count({
        where: {
          userId,
          read: false,
        },
      }),
    ]);

    deferRealtimeEvent(() => {
      emitRealtimeEvent(userId, 'notifications.refresh', {
        reason: 'read',
        notificationId,
      });
    });

    return res.json({ success: true, notification: updatedNotification, unreadCount });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const markAllNotificationsRead = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;

    await prisma.notification.updateMany({
      where: {
        userId,
        read: false,
      },
      data: {
        read: true,
        readAt: new Date(),
      },
    });

    deferRealtimeEvent(() => {
      emitRealtimeEvent(userId, 'notifications.refresh', {
        reason: 'read_all',
      });
    });

    return res.json({ success: true, unreadCount: 0 });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
