import { Server, Socket } from 'socket.io';
import { redis } from '../config/redis';
import prisma from '../config/db';

// Track online users: userId -> Set of socket IDs (to support multiple tabs/connections)
export const onlineUsers = new Map<string, Set<string>>();

export const setupSocketHandlers = (io: Server) => {
  io.on('connection', (socket: Socket) => {
    let currentUserId: string | null = null;

    // Authenticate and register user connection
    socket.on('register_user', async (userId: string) => {
      currentUserId = userId;
      
      if (!onlineUsers.has(userId)) {
        onlineUsers.set(userId, new Set());
      }
      onlineUsers.get(userId)!.add(socket.id);

      // Save online status in Redis
      await redis.set(`online:${userId}`, 'true');

      // Update last seen in DB
      await prisma.userSettings.updateMany({
        where: { userId },
        data: { lastSeen: new Date() }
      });

      // Broadcast online status to friends
      broadcastUserStatus(io, userId, true);
      console.log(`User ${userId} registered socket ${socket.id}`);
    });

    // Join room (can be group room ID or direct DM room ID)
    socket.on('join_room', (roomId: string) => {
      socket.join(roomId);
      console.log(`Socket ${socket.id} joined room ${roomId}`);
    });

    // Leave room
    socket.on('leave_room', (roomId: string) => {
      socket.leave(roomId);
      console.log(`Socket ${socket.id} left room ${roomId}`);
    });

    // Typing status
    socket.on('typing_status', async (data: { roomId: string; userId: string; isTyping: boolean }) => {
      const { roomId, userId, isTyping } = data;
      if (isTyping) {
        await redis.set(`typing:${roomId}:${userId}`, 'true', 'EX', 5);
      } else {
        await redis.del(`typing:${roomId}:${userId}`);
      }
      // Broadcast typing indicator to other users in the room
      socket.to(roomId).emit('typing_update', { roomId, userId, isTyping });
    });

    // Message read receipts
    socket.on('message_read', async (data: { roomId: string; messageId: string; userId: string }) => {
      const { roomId, messageId, userId } = data;
      // Broadcast read receipt to other participants in the room
      socket.to(roomId).emit('read_receipt', { roomId, messageId, readBy: userId });
    });

    // Disconnect cleanup
    socket.on('disconnect', async () => {
      console.log(`Socket ${socket.id} disconnected`);
      if (currentUserId) {
        const userSockets = onlineUsers.get(currentUserId);
        if (userSockets) {
          userSockets.delete(socket.id);
          if (userSockets.size === 0) {
            onlineUsers.delete(currentUserId);
            // Remove online status from Redis
            await redis.del(`online:${currentUserId}`);
            
            // Record last seen time
            await prisma.userSettings.updateMany({
              where: { userId: currentUserId },
              data: { lastSeen: new Date() }
            });

            // Broadcast offline status to friends
            broadcastUserStatus(io, currentUserId, false);
          }
        }
      }
    });
  });
};

const broadcastUserStatus = async (io: Server, userId: string, isOnline: boolean) => {
  try {
    // Find all accepted friends of this user
    const friends = await prisma.friend.findMany({
      where: {
        OR: [
          { senderId: userId, status: 'ACCEPTED' },
          { receiverId: userId, status: 'ACCEPTED' }
        ]
      }
    });

    friends.forEach((friend) => {
      const friendId = friend.senderId === userId ? friend.receiverId : friend.senderId;
      const friendSockets = onlineUsers.get(friendId);
      if (friendSockets) {
        friendSockets.forEach((socketId) => {
          io.to(socketId).emit('user_status_update', {
            userId,
            isOnline,
            lastSeen: new Date()
          });
        });
      }
    });
  } catch (error) {
    console.error('Error broadcasting user status:', error);
  }
};
