import { randomUUID } from 'crypto';
import { Response } from 'express';

type RealtimeClient = {
  id: string;
  response: Response;
};

type RealtimeEventPayload = Record<string, unknown>;

const clientsByUserId = new Map<string, Map<string, RealtimeClient>>();

const stringifyEvent = (event: string, payload: RealtimeEventPayload) =>
  `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;

export const writeRealtimeEvent = (
  response: Response,
  event: string,
  payload: RealtimeEventPayload = {},
) => {
  if (response.writableEnded || response.destroyed) {
    return false;
  }

  response.write(stringifyEvent(event, payload));
  return true;
};

export const registerRealtimeClient = (userId: string, response: Response) => {
  const clientId = randomUUID();
  const existingClients = clientsByUserId.get(userId) || new Map<string, RealtimeClient>();

  existingClients.set(clientId, {
    id: clientId,
    response,
  });
  clientsByUserId.set(userId, existingClients);

  response.write('retry: 3000\n\n');
  writeRealtimeEvent(response, 'connected', {
    userId,
    connectedAt: new Date().toISOString(),
  });

  return () => {
    const userClients = clientsByUserId.get(userId);
    if (!userClients) return;

    userClients.delete(clientId);

    if (userClients.size === 0) {
      clientsByUserId.delete(userId);
    }
  };
};

export const emitRealtimeEvent = (
  userId: string,
  event: string,
  payload: RealtimeEventPayload = {},
) => {
  const userClients = clientsByUserId.get(userId);
  if (!userClients || userClients.size === 0) {
    return;
  }

  for (const [clientId, client] of userClients.entries()) {
    const wrote = writeRealtimeEvent(client.response, event, payload);

    if (!wrote) {
      userClients.delete(clientId);
    }
  }

  if (userClients.size === 0) {
    clientsByUserId.delete(userId);
  }
};

export const emitRealtimeEventToUsers = (
  userIds: string[],
  event: string,
  payload: RealtimeEventPayload = {},
) => {
  const uniqueUserIds = Array.from(new Set(userIds.filter(Boolean)));
  for (const userId of uniqueUserIds) {
    emitRealtimeEvent(userId, event, payload);
  }
};

export const deferRealtimeEvent = (callback: () => void) => {
  setTimeout(callback, 0);
};
