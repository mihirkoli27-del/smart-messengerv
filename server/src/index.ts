import express from 'express';
import http from 'http';
import cors from 'cors';
import dotenv from 'dotenv';
import { Server } from 'socket.io';
import authRoutes from './routes/authRoutes';
import userRoutes from './routes/userRoutes';
import friendRoutes from './routes/friendRoutes';
import groupRoutes from './routes/groupRoutes';
import messageRoutes from './routes/messageRoutes';
import adminRoutes from './routes/adminRoutes';
import aiRoutes from './routes/aiRoutes';
import prisma from './config/db';
import { redis, redisSub, enableKeyspaceNotifications } from './config/redis';
import { setupSocketHandlers } from './socket/socketHandler';
import path from 'path';

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true,
  },
});

// Expose Socket.IO instance to routes
app.set('io', io);

app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json());

// Serve static uploads
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/friends', friendRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/ai', aiRoutes);

// Socket IO handlers
setupSocketHandlers(io);

// Subscribe to Redis keyspace notification events for key expirations
const setupRedisExpirationListener = async () => {
  try {
    const expiredChannel = '__keyevent@0__:expired';
    await redisSub.subscribe(expiredChannel);
    console.log(`Subscribed to Redis expired channel: ${expiredChannel}`);

    redisSub.on('message', async (channel, expiredKey) => {
      if (channel === expiredChannel) {
        // Format expected: message:roomId:messageId
        if (expiredKey.startsWith('message:') && !expiredKey.startsWith('message:shadow:')) {
          const parts = expiredKey.split(':');
          if (parts.length >= 3) {
            const roomId = parts[1];
            const messageId = parts[2];
            
            console.log(`Message expired in Redis: ${messageId} in room ${roomId}`);

            // 1. Check shadow key for file details (has +10s TTL)
            const shadowKey = `message:shadow:${roomId}:${messageId}`;
            const shadowVal = await redis.get(shadowKey);
            
            if (shadowVal) {
              const fs = require('fs');
              try {
                const shadowObj = JSON.parse(shadowVal);
                if (shadowObj.filePath) {
                  fs.unlink(shadowObj.filePath, (err: any) => {
                    if (err) {
                      console.error(`Failed to delete expired file ${shadowObj.filePath}:`, err);
                    } else {
                      console.log(`Successfully deleted expired file ${shadowObj.filePath}`);
                    }
                  });
                }
              } catch (e) {
                console.error('Error parsing shadow key JSON:', e);
              }
              // Clean up shadow key
              await redis.del(shadowKey);
            }

            // 2. Clean index ZSET
            const indexKey = `chat:${roomId}:messages`;
            await redis.zrem(indexKey, messageId);

            // 3. Broadcast real-time deletion to active room sockets
            io.to(roomId).emit('message_expired', { messageId, roomId });
          }
        }
      }
    });
  } catch (err) {
    console.error('Failed to set up Redis expiration subscription:', err);
  }
};

// Basic health check
app.get('/health', async (req, res) => {
  try {
    // Check DB connection
    await prisma.$queryRaw`SELECT 1`;
    // Check Redis connection
    const redisStatus = await redis.ping();
    
    res.status(200).json({
      status: 'OK',
      database: 'CONNECTED',
      redis: redisStatus === 'PONG' ? 'CONNECTED' : 'DISCONNECTED',
      uptime: process.uptime(),
    });
  } catch (err: any) {
    res.status(500).json({
      status: 'ERROR',
      message: err.message,
    });
  }
});

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    // Attempt database connection check
    await prisma.$connect();
    console.log('Database connected successfully.');

    // Enable Redis keyspace notifications
    await enableKeyspaceNotifications();

    // Start listening for key expirations
    await setupRedisExpirationListener();

    server.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
