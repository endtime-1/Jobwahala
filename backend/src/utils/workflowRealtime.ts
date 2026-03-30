import { deferRealtimeEvent, emitRealtimeEventToUsers } from '../services/realtime';

type WorkflowRealtimePayload = Record<string, unknown>;

export const emitProposalRefresh = (
  userIds: string[],
  payload: WorkflowRealtimePayload = {},
) => {
  deferRealtimeEvent(() => {
    emitRealtimeEventToUsers(userIds, 'proposals.refresh', payload);
  });
};

export const emitAgreementRefresh = (
  userIds: string[],
  payload: WorkflowRealtimePayload = {},
) => {
  deferRealtimeEvent(() => {
    emitRealtimeEventToUsers(userIds, 'agreements.refresh', payload);
  });
};
