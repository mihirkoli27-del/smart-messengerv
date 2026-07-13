import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth';
import prisma from '../config/db';

export const getProfile = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        username: true,
        email: true,
        profilePhoto: true,
        bio: true,
        createdAt: true,
        isSuspended: true,
        publicKey: true,
        settings: true
      }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.status(200).json(user);
  } catch (error: any) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateProfile = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;
    const { name, bio, profilePhoto, publicKey } = req.body;

    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        name,
        bio,
        profilePhoto,
        publicKey
      },
      select: {
        id: true,
        name: true,
        username: true,
        email: true,
        profilePhoto: true,
        bio: true,
        publicKey: true
      }
    });

    res.status(200).json({
      message: 'Profile updated successfully',
      user: updatedUser
    });
  } catch (error: any) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateSettings = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;
    const { lastSeenVisibility, onlineStatusVisibility, readReceipts, messageTimerDefault, allowMessagesFrom } = req.body;

    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const updatedSettings = await prisma.userSettings.update({
      where: { userId },
      data: {
        lastSeenVisibility,
        onlineStatusVisibility,
        readReceipts,
        messageTimerDefault,
        allowMessagesFrom
      }
    });

    res.status(200).json({
      message: 'Settings updated successfully',
      settings: updatedSettings
    });
  } catch (error: any) {
    console.error('Update settings error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const searchUsers = async (req: AuthRequest, res: Response) => {
  try {
    const { query } = req.query;
    const userId = req.userId;

    if (!query || typeof query !== 'string') {
      return res.status(400).json({ error: 'Search query is required' });
    }

    // Search users by name or username, excluding the requesting user and suspended users
    const users = await prisma.user.findMany({
      where: {
        OR: [
          { name: { contains: query, mode: 'insensitive' } },
          { username: { contains: query, mode: 'insensitive' } }
        ],
        NOT: { id: userId },
        isSuspended: false
      },
      select: {
        id: true,
        name: true,
        username: true,
        profilePhoto: true,
        bio: true,
        publicKey: true
      },
      take: 20
    });

    res.status(200).json(users);
  } catch (error: any) {
    console.error('Search users error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const blockUser = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;
    const { targetUserId } = req.body;

    if (!userId || !targetUserId) {
      return res.status(400).json({ error: 'Target user ID is required' });
    }

    if (userId === targetUserId) {
      return res.status(400).json({ error: 'You cannot block yourself' });
    }

    // Create or update a block relation (represented in Friend table as BLOCKED)
    await prisma.friend.upsert({
      where: {
        senderId_receiverId: {
          senderId: userId,
          receiverId: targetUserId
        }
      },
      update: {
        status: 'BLOCKED'
      },
      create: {
        senderId: userId,
        receiverId: targetUserId,
        status: 'BLOCKED'
      }
    });

    res.status(200).json({ message: 'User blocked successfully' });
  } catch (error: any) {
    console.error('Block user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const unblockUser = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;
    const { targetUserId } = req.body;

    if (!userId || !targetUserId) {
      return res.status(400).json({ error: 'Target user ID is required' });
    }

    const blockRelation = await prisma.friend.findFirst({
      where: {
        senderId: userId,
        receiverId: targetUserId,
        status: 'BLOCKED'
      }
    });

    if (blockRelation) {
      await prisma.friend.delete({
        where: { id: blockRelation.id }
      });
      return res.status(200).json({ message: 'User unblocked successfully' });
    }

    res.status(400).json({ error: 'User is not blocked' });
  } catch (error: any) {
    console.error('Unblock user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const reportUser = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;
    const { targetUserId, reason, evidence } = req.body;

    if (!userId || !targetUserId || !reason) {
      return res.status(400).json({ error: 'Target user ID and reason are required' });
    }

    const report = await prisma.report.create({
      data: {
        reporterId: userId,
        reportedId: targetUserId,
        reason,
        evidence: evidence || null
      }
    });

    res.status(201).json({
      message: 'Report filed successfully',
      reportId: report.id
    });
  } catch (error: any) {
    console.error('Report user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
