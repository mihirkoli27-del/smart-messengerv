import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth';
import prisma from '../config/db';

export const sendFriendRequest = async (req: AuthRequest, res: Response) => {
  try {
    const senderId = req.userId;
    const { receiverId } = req.body;

    if (!senderId || !receiverId) {
      return res.status(400).json({ error: 'Receiver ID is required' });
    }

    if (senderId === receiverId) {
      return res.status(400).json({ error: 'You cannot send a friend request to yourself' });
    }

    // Check if the receiver exists and is not suspended
    const receiver = await prisma.user.findUnique({
      where: { id: receiverId }
    });

    if (!receiver || receiver.isSuspended) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if a relationship already exists
    const existingRelation = await prisma.friend.findFirst({
      where: {
        OR: [
          { senderId, receiverId },
          { senderId: receiverId, receiverId: senderId }
        ]
      }
    });

    if (existingRelation) {
      if (existingRelation.status === 'ACCEPTED') {
        return res.status(400).json({ error: 'Already friends' });
      }
      if (existingRelation.status === 'BLOCKED') {
        return res.status(400).json({ error: 'Cannot send request (blocked relation)' });
      }
      if (existingRelation.status === 'PENDING') {
        if (existingRelation.senderId === senderId) {
          return res.status(400).json({ error: 'Friend request already sent' });
        } else {
          // If receiver already sent a request to sender, accept it!
          const updated = await prisma.friend.update({
            where: { id: existingRelation.id },
            data: { status: 'ACCEPTED' }
          });
          return res.status(200).json({ message: 'Friend request accepted', relation: updated });
        }
      }
    }

    // Create a new friend request
    const request = await prisma.friend.create({
      data: {
        senderId,
        receiverId,
        status: 'PENDING'
      }
    });

    res.status(201).json({ message: 'Friend request sent successfully', request });
  } catch (error: any) {
    console.error('Send friend request error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const acceptFriendRequest = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;
    const { requestId } = req.body;

    if (!userId || !requestId) {
      return res.status(400).json({ error: 'Request ID is required' });
    }

    const relation = await prisma.friend.findUnique({
      where: { id: requestId }
    });

    if (!relation || relation.receiverId !== userId || relation.status !== 'PENDING') {
      return res.status(404).json({ error: 'Friend request not found or unauthorized' });
    }

    const updated = await prisma.friend.update({
      where: { id: requestId },
      data: { status: 'ACCEPTED' }
    });

    res.status(200).json({ message: 'Friend request accepted successfully', relation: updated });
  } catch (error: any) {
    console.error('Accept friend request error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const rejectFriendRequest = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;
    const { requestId } = req.body;

    if (!userId || !requestId) {
      return res.status(400).json({ error: 'Request ID is required' });
    }

    const relation = await prisma.friend.findUnique({
      where: { id: requestId }
    });

    if (!relation || relation.receiverId !== userId || relation.status !== 'PENDING') {
      return res.status(404).json({ error: 'Friend request not found or unauthorized' });
    }

    await prisma.friend.delete({
      where: { id: requestId }
    });

    res.status(200).json({ message: 'Friend request rejected' });
  } catch (error: any) {
    console.error('Reject friend request error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const removeFriend = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;
    const { friendId } = req.body;

    if (!userId || !friendId) {
      return res.status(400).json({ error: 'Friend ID is required' });
    }

    const relation = await prisma.friend.findFirst({
      where: {
        OR: [
          { senderId: userId, receiverId: friendId, status: 'ACCEPTED' },
          { senderId: friendId, receiverId: userId, status: 'ACCEPTED' }
        ]
      }
    });

    if (!relation) {
      return res.status(404).json({ error: 'Friend connection not found' });
    }

    await prisma.friend.delete({
      where: { id: relation.id }
    });

    res.status(200).json({ message: 'Friend removed successfully' });
  } catch (error: any) {
    console.error('Remove friend error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getFriendsAndRequests = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    // Fetch all relations involving the current user
    const relations = await prisma.friend.findMany({
      where: {
        OR: [
          { senderId: userId },
          { receiverId: userId }
        ]
      },
      include: {
        sender: {
          select: {
            id: true,
            name: true,
            username: true,
            profilePhoto: true,
            bio: true,
            publicKey: true
          }
        },
        receiver: {
          select: {
            id: true,
            name: true,
            username: true,
            profilePhoto: true,
            bio: true,
            publicKey: true
          }
        }
      }
    });

    const friends: any[] = [];
    const pendingSent: any[] = [];
    const pendingReceived: any[] = [];
    const blocked: any[] = [];

    relations.forEach((rel) => {
      const isSender = rel.senderId === userId;
      const otherUser = isSender ? rel.receiver : rel.sender;

      if (rel.status === 'ACCEPTED') {
        friends.push({
          id: rel.id,
          friend: otherUser
        });
      } else if (rel.status === 'PENDING') {
        if (isSender) {
          pendingSent.push({
            id: rel.id,
            user: otherUser
          });
        } else {
          pendingReceived.push({
            id: rel.id,
            user: otherUser
          });
        }
      } else if (rel.status === 'BLOCKED' && isSender) {
        // Only show blocked users to the person who blocked them
        blocked.push({
          id: rel.id,
          user: otherUser
        });
      }
    });

    res.status(200).json({
      friends,
      pendingSent,
      pendingReceived,
      blocked
    });
  } catch (error: any) {
    console.error('Get friends error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
