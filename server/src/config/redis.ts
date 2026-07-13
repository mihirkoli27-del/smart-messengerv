import Redis from 'ioredis';
import dotenv from 'dotenv';

dotenv.config();

const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';

// Main Redis client for standard commands
const redis = new Redis(redisUrl, {
  maxRetriesPerRequest: null,
});

// Subscriber Redis client for listening to keyspace notifications
const redisSub = new Redis(redisUrl, {
  maxRetriesPerRequest: null,
});

redis.on('connect', () => {
  console.log('Redis connected successfully.');
});

redis.on('error', (err) => {
  console.error('Redis connection error:', err);
});

redisSub.on('error', (err) => {
  console.error('Redis Subscriber connection error:', err);
});

// Enable keyspace notifications for expired events (Keyevent expired)
const enableKeyspaceNotifications = async () => {
  try {
    // 'Ex' means Keyevent Expired notifications
    await redis.config('SET', 'notify-keyspace-events', 'Ex');
    console.log('Redis keyspace notifications enabled successfully.');
  } catch (err) {
    console.warn(
      'Warning: Failed to auto-configure Redis notify-keyspace-events via CONFIG command. ' +
      'If using a managed service like Redis Cloud, enable expired keyspace notifications (type "Ex") manually.',
      err
    );
  }
};

export { redis, redisSub, enableKeyspaceNotifications };
