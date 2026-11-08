import type { Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const prismaMock = vi.hoisted(() => ({ conversation: { findUnique: vi.fn() }, message: { create: vi.fn() } }));
const realtime = vi.hoisted(() => ({ emitRealtimeEvent: vi.fn(), emitRealtimeEventToUsers: vi.fn(), deferRealtimeEvent: vi.fn() }));
vi.mock('../../config/prisma', () => ({ default: prismaMock }));
vi.mock('../../services/realtime', () => realtime);
vi.mock('../../services/socketService', () => ({ emitToUsers: vi.fn() }));

import { sendTyping } from '../../controllers/messageController';

const respond = () => {
  const out: { status: number; body: any } = { status: 200, body: null };
  const res = { status: (code: number) => ((out.status = code), res), json: (body: unknown) => ((out.body = body), res) } as unknown as Response;
  return { res, out };
};

beforeEach(() => vi.clearAllMocks());

describe('typing indicators', () => {
  it('tell the other person in the conversation, and only them', async () => {
    prismaMock.conversation.findUnique.mockResolvedValue({ id: 'c1', user1Id: 'me', user2Id: 'them' });
    const { res, out } = respond();

    await sendTyping({ user: { id: 'me', role: 'EMPLOYER' }, params: { id: 'c1' } } as never, res);

    expect(out.body.success).toBe(true);
    expect(realtime.emitRealtimeEvent).toHaveBeenCalledTimes(1);
    expect(realtime.emitRealtimeEvent).toHaveBeenCalledWith('them', 'messages.typing', { conversationId: 'c1', userId: 'me' });
  });

  it('work the same from the other side of the conversation', async () => {
    prismaMock.conversation.findUnique.mockResolvedValue({ id: 'c1', user1Id: 'them', user2Id: 'me' });
    const { res } = respond();

    await sendTyping({ user: { id: 'me', role: 'SEEKER' }, params: { id: 'c1' } } as never, res);

    expect(realtime.emitRealtimeEvent).toHaveBeenCalledWith('them', 'messages.typing', expect.any(Object));
  });

  it('are refused for someone who is not in the conversation, and send nothing', async () => {
    prismaMock.conversation.findUnique.mockResolvedValue({ id: 'c1', user1Id: 'a', user2Id: 'b' });
    const { res, out } = respond();

    await sendTyping({ user: { id: 'intruder', role: 'SEEKER' }, params: { id: 'c1' } } as never, res);

    expect(out.status).toBe(403);
    expect(realtime.emitRealtimeEvent).not.toHaveBeenCalled();
  });

  it('are not stored anywhere', async () => {
    prismaMock.conversation.findUnique.mockResolvedValue({ id: 'c1', user1Id: 'me', user2Id: 'them' });
    const { res } = respond();

    await sendTyping({ user: { id: 'me', role: 'EMPLOYER' }, params: { id: 'c1' } } as never, res);

    expect(prismaMock.message.create).not.toHaveBeenCalled();
  });
});
