import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth';
import { redis } from '../config/redis';
import prisma from '../config/db';
import { randomUUID } from 'crypto';

// Helper to get a sorted room identifier for Direct Messages (1-to-1)
export const getDmRoomId = (user1: string, user2: string) => {
  return `dm_${[user1, user2].sort().join('_')}`;
};

export const sendMessage = async (req: AuthRequest, res: Response) => {
  try {
    const senderId = req.userId;
    const { receiverId, chatType, encryptedContent, iv, encryptedKeys, duration, isEncrypted } = req.body;

    if (!senderId || !receiverId || !chatType || !duration) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    const expireSeconds = parseInt(duration);
    if (isNaN(expireSeconds) || expireSeconds <= 0) {
      return res.status(400).json({ error: 'Invalid message expiration timer' });
    }

    const messageId = randomUUID();
    const timestamp = Date.now();
    const expiresAt = timestamp + expireSeconds * 1000;

    let fileData = {};
    if (req.file) {
      // Create local file URL
      const fileUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
      fileData = {
        fileUrl,
        fileName: req.file.originalname,
        fileSize: req.file.size,
        fileMime: req.file.mimetype,
        filePath: req.file.path // Stored internally to delete file from disk when key expires
      };
    }

    const roomId = chatType === 'DIRECT' 
      ? getDmRoomId(senderId, receiverId)
      : `group_${receiverId}`;

    const messageObj = {
      id: messageId,
      roomId,
      chatType,
      senderId,
      receiverId,
      encryptedContent: encryptedContent || null,
      iv: iv || null,
      encryptedKeys: encryptedKeys ? JSON.parse(encryptedKeys) : null,
      isEncrypted: isEncrypted === 'true' || isEncrypted === true,
      timestamp,
      expiresAt,
      ...fileData
    };

    // 1. Store message details as a stringified JSON key in Redis with TTL
    // Key: message:{roomId}:{messageId}
    const redisKey = `message:${roomId}:${messageId}`;
    await redis.set(redisKey, JSON.stringify(messageObj), 'EX', expireSeconds);

    // 1b. If a file is present, write a shadow key with +10s TTL so the system can retrieve the file path for deletion upon message expiration
    if (req.file) {
      const shadowKey = `message:shadow:${roomId}:${messageId}`;
      await redis.set(shadowKey, JSON.stringify({ filePath: req.file.path }), 'EX', expireSeconds + 10);
    }

    // 2. Track message ordering in the chat session's index (ZSET)
    // Key: chat:{roomId}:messages
    const indexKey = `chat:${roomId}:messages`;
    await redis.zadd(indexKey, timestamp, messageId);

    // 3. Broadcast the new message event in real-time to the socket room
    const io = req.app.get('io');
    if (io) {
      io.to(roomId).emit('new_message', messageObj);
    }

    res.status(201).json(messageObj);
  } catch (error: any) {
    console.error('Send message error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getMessages = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;
    const { roomId } = req.params; // Expecting dm_user1_user2 or group_groupId

    if (!userId || !roomId) {
      return res.status(400).json({ error: 'Room ID is required' });
    }

    // Verify room access authorization
    if (roomId.startsWith('dm_')) {
      const parts = roomId.split('_');
      if (parts[1] !== userId && parts[2] !== userId) {
        return res.status(403).json({ error: 'Access forbidden: not a chat participant' });
      }
    } else if (roomId.startsWith('group_')) {
      const groupId = roomId.replace('group_', '');
      const membership = await prisma.groupMember.findFirst({
        where: { groupId, userId }
      });
      if (!membership) {
        return res.status(403).json({ error: 'Access forbidden: not a group member' });
      }
    } else {
      return res.status(400).json({ error: 'Invalid Room ID format' });
    }

    // Fetch all message IDs inside this room
    const indexKey = `chat:${roomId}:messages`;
    const messageIds = await redis.zrange(indexKey, 0, -1);

    if (messageIds.length === 0) {
      return res.status(200).json([]);
    }

    // Fetch contents of all active keys in parallel
    const pipeline = redis.pipeline();
    messageIds.forEach((msgId) => {
      pipeline.get(`message:${roomId}:${msgId}`);
    });
    const results = await pipeline.exec();

    const activeMessages: any[] = [];
    const expiredIds: string[] = [];

    results?.forEach((res, index) => {
      const [err, val] = res;
      const msgId = messageIds[index];
      if (val) {
        activeMessages.push(JSON.parse(val as string));
      } else {
        // Key has expired, collect ID to clean up ZSET
        expiredIds.push(msgId);
      }
    });

    // Clean up expired message IDs in the background to self-clean index
    if (expiredIds.length > 0) {
      await redis.zrem(indexKey, ...expiredIds);
    }

    res.status(200).json(activeMessages);
  } catch (error: any) {
    console.error('Get messages error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
