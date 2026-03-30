import { PrismaClient } from '@prisma/client';
import { deferRealtimeEvent, emitRealtimeEvent } from '../services/realtime';

type NotificationClient = Pick<PrismaClient, 'notification'>;

type CreateNotificationInput = {
  userId: string;
  type: string;
  title: string;
  message: string;
  actionUrl?: string | null;
};

export const createNotification = async (
  client: NotificationClient,
  { userId, type, title, message, actionUrl }: CreateNotificationInput
) => {
  const notification = await client.notification.create({
    data: {
      userId,
      type,
      title,
      message,
      actionUrl: actionUrl || null,
    },
  });

  deferRealtimeEvent(() => {
    emitRealtimeEvent(userId, 'notifications.refresh', {
      reason: 'created',
      notificationId: notification.id,
    });
  });

  return notification;
};

export const createNotifications = async (
  client: NotificationClient,
  notifications: CreateNotificationInput[]
) => {
  const dedupedNotifications = notifications.filter(
    (notification, index, allNotifications) =>
      notification.userId &&
      index ===
        allNotifications.findIndex(
          (candidate) =>
            candidate.userId === notification.userId &&
            candidate.type === notification.type &&
            candidate.title === notification.title &&
            candidate.message === notification.message &&
            (candidate.actionUrl || null) === (notification.actionUrl || null)
        )
  );

  if (dedupedNotifications.length === 0) {
    return;
  }

  await client.notification.createMany({
    data: dedupedNotifications.map((notification) => ({
      userId: notification.userId,
      type: notification.type,
      title: notification.title,
      message: notification.message,
      actionUrl: notification.actionUrl || null,
    })),
  });

  const uniqueUserIds = Array.from(new Set(dedupedNotifications.map((notification) => notification.userId)));
  deferRealtimeEvent(() => {
    for (const userId of uniqueUserIds) {
      emitRealtimeEvent(userId, 'notifications.refresh', {
        reason: 'created',
      });
    }
  });
};
