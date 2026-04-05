import { deferRealtimeEvent, emitRealtimeEventToUsers } from '../services/realtime';
import { emitToUsers as emitSocketToUsers } from '../services/socketService';

type WorkflowRealtimePayload = Record<string, unknown>;

export const emitProposalRefresh = (
  userIds: string[],
  payload: WorkflowRealtimePayload = {},
) => {
  deferRealtimeEvent(() => {
    emitRealtimeEventToUsers(userIds, 'proposals.refresh', payload);
    emitSocketToUsers(userIds, 'proposals.refresh', payload);
  });
};

export const emitAgreementRefresh = (
  userIds: string[],
  payload: WorkflowRealtimePayload = {},
) => {
  deferRealtimeEvent(() => {
    emitRealtimeEventToUsers(userIds, 'agreements.refresh', payload);
    emitSocketToUsers(userIds, 'agreements.refresh', payload);
  });
};

export const emitMessageRefresh = (
  userIds: string[],
  payload: WorkflowRealtimePayload = {},
) => {
  deferRealtimeEvent(() => {
    emitRealtimeEventToUsers(userIds, 'messages.refresh', payload);
    emitSocketToUsers(userIds, 'messages.refresh', payload);
  });
};

export const emitNotificationRefresh = (
  userIds: string[],
  payload: WorkflowRealtimePayload = {},
) => {
  deferRealtimeEvent(() => {
    emitRealtimeEventToUsers(userIds, 'notifications.refresh', payload);
    emitSocketToUsers(userIds, 'notifications.refresh', payload);
  });
};
