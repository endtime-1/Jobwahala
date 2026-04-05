import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import prisma from '../config/prisma';
import { singleValue } from '../utils/request';
import { deferRealtimeEvent, emitRealtimeEventToUsers } from '../services/realtime';
import { emitMessageRefresh } from '../utils/workflowRealtime';

const conversationSummaryInclude = {
  user1: { select: { id: true, email: true } },
  user2: { select: { id: true, email: true } },
  messages: { orderBy: { createdAt: 'desc' }, take: 1 },
} as const;

const getConversationUnreadCountMap = async (userId: string, conversationIds: string[]) => {
  if (conversationIds.length === 0) {
    return new Map<string, number>();
  }

  const unreadCounts = await prisma.message.groupBy({
    by: ['conversationId'],
    where: {
      conversationId: { in: conversationIds },
      senderId: { not: userId },
      read: false,
    },
    _count: {
      conversationId: true,
    },
  });

  return new Map(
    unreadCounts.map((item) => [item.conversationId, item._count.conversationId]),
  );
};

const getRecentMessageSummaries = async (userId: string, take = 5) => {
  const [conversations, unreadMessages] = await Promise.all([
    prisma.conversation.findMany({
      where: {
        OR: [{ user1Id: userId }, { user2Id: userId }]
      },
      orderBy: { updatedAt: 'desc' },
      include: conversationSummaryInclude,
      take,
    }),
    prisma.message.count({
      where: {
        read: false,
        senderId: { not: userId },
        conversation: {
          OR: [{ user1Id: userId }, { user2Id: userId }]
        }
      }
    })
  ]);

  const unreadCountMap = await getConversationUnreadCountMap(
    userId,
    conversations.map((conversation) => conversation.id),
  );

  const recentMessages = conversations.map((conversation) => {
    const participant = conversation.user1Id === userId ? conversation.user2 : conversation.user1;

    return {
      id: conversation.id,
      participant,
      lastMessage: conversation.messages[0] || null,
      unreadCount: unreadCountMap.get(conversation.id) || 0,
    };
  });

  return {
    recentMessages,
    unreadMessages,
  };
};

const getConversationForUser = async (conversationId: string, userId: string) => {
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
  });

  if (!conversation || (conversation.user1Id !== userId && conversation.user2Id !== userId)) {
    return null;
  }

  return conversation;
};

const getConversationSidebarItems = async (userId: string) => {
  const conversations = await prisma.conversation.findMany({
    where: {
      OR: [{ user1Id: userId }, { user2Id: userId }]
    },
    orderBy: { updatedAt: 'desc' },
    include: conversationSummaryInclude,
  });

  const unreadCountMap = await getConversationUnreadCountMap(
    userId,
    conversations.map((conversation) => conversation.id),
  );

  return conversations.map((conversation) => ({
    id: conversation.id,
    participant: conversation.user1Id === userId ? conversation.user2 : conversation.user1,
    lastMessage: conversation.messages[0] || null,
    unreadCount: unreadCountMap.get(conversation.id) || 0,
  }));
};

export const getConversations = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const conversations = await prisma.conversation.findMany({
      where: {
        OR: [{ user1Id: userId }, { user2Id: userId }]
      },
      orderBy: { updatedAt: 'desc' },
      include: conversationSummaryInclude,
    });

    const unreadCountMap = await getConversationUnreadCountMap(
      userId,
      conversations.map((conversation) => conversation.id),
    );

    const mapped = conversations.map((conversation) => ({
      ...conversation,
      unreadCount: unreadCountMap.get(conversation.id) || 0,
    }));

    res.json({ success: true, conversations: mapped });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getConversationSidebar = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const conversations = await getConversationSidebarItems(userId);

    res.json({ success: true, conversations });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getMessageSummary = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const summary = await getRecentMessageSummaries(userId);

    res.json({
      success: true,
      ...summary,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getMessages = async (req: AuthRequest, res: Response) => {
  try {
    const conversationId = singleValue(req.params.id);
    const userId = req.user!.id;

    if (!conversationId) {
      return res.status(400).json({ success: false, message: 'Conversation id is required' });
    }

    const conversation = await getConversationForUser(conversationId, userId);
    if (!conversation) {
       return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const messages = await prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' }
    });

    res.json({ success: true, messages });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getMessageDelta = async (req: AuthRequest, res: Response) => {
  try {
    const conversationId = singleValue(req.params.id);
    const userId = req.user!.id;
    const after = singleValue(req.query.after as string | string[] | undefined);

    if (!conversationId) {
      return res.status(400).json({ success: false, message: 'Conversation id is required' });
    }

    if (!after) {
      return res.status(400).json({ success: false, message: 'An after timestamp is required' });
    }

    const afterDate = new Date(after);
    if (Number.isNaN(afterDate.getTime())) {
      return res.status(400).json({ success: false, message: 'The after timestamp is invalid' });
    }

    const conversation = await getConversationForUser(conversationId, userId);
    if (!conversation) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const messages = await prisma.message.findMany({
      where: {
        conversationId,
        createdAt: {
          gte: afterDate,
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return res.json({ success: true, messages });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const sendMessage = async (req: AuthRequest, res: Response) => {
  try {
    const {
      receiverId,
      content,
      attachmentUrl,
      attachmentName,
      attachmentContentType,
      attachmentSizeBytes,
    } = req.body as {
      receiverId: string;
      content?: string;
      attachmentUrl?: string;
      attachmentName?: string;
      attachmentContentType?: string;
      attachmentSizeBytes?: number;
    };
    const senderId = req.user!.id;
    const normalizedContent = content?.trim() || null;
    const normalizedAttachmentUrl = attachmentUrl?.trim() || null;

    if (!receiverId || (!normalizedContent && !normalizedAttachmentUrl)) {
      return res.status(400).json({ success: false, message: 'Receiver plus content or an attachment is required' });
    }

    if (receiverId === senderId) {
      return res.status(400).json({ success: false, message: 'Cannot message yourself' });
    }

    const receiver = await prisma.user.findUnique({ where: { id: receiverId } });
    if (!receiver) {
      return res.status(404).json({ success: false, message: 'Receiver not found' });
    }

    const message = await prisma.$transaction(async (tx) => {
      let conversation = await tx.conversation.findFirst({
        where: {
          OR: [
            { user1Id: senderId, user2Id: receiverId },
            { user1Id: receiverId, user2Id: senderId }
          ]
        }
      });

      if (!conversation) {
        conversation = await tx.conversation.create({
          data: { user1Id: senderId, user2Id: receiverId }
        });
      } else {
        conversation = await tx.conversation.update({
          where: { id: conversation.id },
          data: { updatedAt: new Date() }
        });
      }

      return tx.message.create({
        data: {
          conversationId: conversation.id,
          senderId,
          content: normalizedContent,
          attachmentUrl: normalizedAttachmentUrl,
          attachmentName: attachmentName?.trim() || null,
          attachmentContentType: attachmentContentType?.trim() || null,
          attachmentSizeBytes: attachmentSizeBytes ?? null,
        }
      });
    });

    emitMessageRefresh(
      [senderId, receiverId],
      {
        reason: 'created',
        conversationId: message.conversationId,
        messageId: message.id,
        createdAt: message.createdAt.toISOString(),
        senderId,
      }
    );

    res.status(201).json({ success: true, message });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const markAsRead = async (req: AuthRequest, res: Response) => {
  try {
    const conversationId = singleValue(req.params.id);
    const userId = req.user!.id;

    if (!conversationId) {
      return res.status(400).json({ success: false, message: 'Conversation id is required' });
    }

    const conversation = await getConversationForUser(conversationId, userId);
    if (!conversation) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    await prisma.message.updateMany({
      where: {
        conversationId,
        senderId: { not: userId }, // mark messages sent by others as read
        read: false
      },
      data: { read: true }
    });

    emitMessageRefresh(
      [conversation.user1Id, conversation.user2Id],
      {
        reason: 'read',
        conversationId,
        actorId: userId,
      }
    );

    res.json({ success: true, message: 'Messages marked as read' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
