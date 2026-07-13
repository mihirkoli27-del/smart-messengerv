import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middlewares/auth';
import prisma from '../config/db';
import { redis } from '../config/redis';

// Middleware to check if the user is an Admin
export const isAdmin = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    // Check if user is designated as admin (email or username starting with 'admin')
    const hasAdminCreds = user && (user.username.toLowerCase().startsWith('admin') || user.email.toLowerCase().startsWith('admin'));

    if (!user || !hasAdminCreds) {
      return res.status(403).json({ error: 'Forbidden: Admin credentials required' });
    }

    next();
  } catch (error) {
    res.status(500).json({ error: 'Internal server error validating admin credentials' });
  }
};

export const getReports = async (req: AuthRequest, res: Response) => {
  try {
    const reports = await prisma.report.findMany({
      include: {
        reporter: {
          select: { id: true, name: true, username: true }
        },
        reported: {
          select: { id: true, name: true, username: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.status(200).json(reports);
  } catch (error: any) {
    console.error('Get reports error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const toggleSuspendUser = async (req: AuthRequest, res: Response) => {
  try {
    const { userId } = req.params;
    const { suspend } = req.body; // Expecting boolean

    if (suspend === undefined) {
      return res.status(400).json({ error: 'Suspend state (true/false) is required' });
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: { isSuspended: suspend }
    });

    // If suspended, immediately revoke active sessions in Redis
    if (suspend) {
      const userKeys = await redis.keys(`refresh_token:${userId}:*`);
      if (userKeys.length > 0) {
        await redis.del(...userKeys);
      }
      await redis.del(`online:${userId}`);
    }

    res.status(200).json({
      message: `User account ${suspend ? 'suspended' : 'restored'} successfully`,
      user: {
        id: user.id,
        username: user.username,
        isSuspended: user.isSuspended
      }
    });
  } catch (error: any) {
    console.error('Suspend user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getStats = async (req: AuthRequest, res: Response) => {
  try {
    const usersCount = await prisma.user.count();
    const activeFriends = await prisma.friend.count({ where: { status: 'ACCEPTED' } });
    const groupsCount = await prisma.group.count();
    const reportsCount = await prisma.report.count();

    // Query active sessions from Redis online heartbeat status keys
    const onlineKeys = await redis.keys('online:*');
    const onlineUsersCount = onlineKeys.length;

    res.status(200).json({
      usersCount,
      activeFriends,
      groupsCount,
      reportsCount,
      onlineUsersCount,
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage()
    });
  } catch (error: any) {
    console.error('Get server stats error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
